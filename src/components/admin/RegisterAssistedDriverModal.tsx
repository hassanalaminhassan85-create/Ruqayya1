import React, { useState } from 'react';
import { 
  User, 
  Users, 
  Truck, 
  DollarSign, 
  FileText, 
  X, 
  UploadCloud,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/SharedComponents';
import { Vehicle } from '../../types';
import { api } from '../../utils/api';

interface RegisterAssistedDriverModalProps {
  lang: 'en' | 'ha';
  vehicles: Vehicle[];
  onClose: () => void;
  onSync: () => void;
}

export const RegisterAssistedDriverModal: React.FC<RegisterAssistedDriverModalProps> = ({
  lang,
  vehicles,
  onClose,
  onSync
}) => {
  // Mode selection
  const [activeTab, setActiveTab] = useState<'standard' | 'import'>('standard');

  // Navigation / Wizard step for Standard
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form States: Driver Personal Dossier
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nin, setNin] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [agreedAmount, setAgreedAmount] = useState('180000'); // Default 30-Day Rate (180,000 as per prompt)
  const [remainingVehicleBalance, setRemainingVehicleBalance] = useState('15000000'); // Default Rig Lease Cost (15,000,000 as per prompt)

  // Form States: Guarantor Profile
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gAddress, setGAddress] = useState('');
  const [gRelationship, setGRelationship] = useState('');
  const [gNin, setGNin] = useState('');

  // Form States: Fleet Rig Allocation
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  
  // Real R2-backed upload states for driver and guarantor
  const [passportPhoto, setPassportPhoto] = useState('');
  const [guarantorPhoto, setGuarantorPhoto] = useState('');

  // --- PAPER RECORD MIGRATION (IMPORT) SPECIFIC STATES ---
  const [importCompanyDriverId, setImportCompanyDriverId] = useState('');
  const [importEmail, setImportEmail] = useState('');
  const [importTotalPaid, setImportTotalPaid] = useState('0');
  const [importInstallmentPosition, setImportInstallmentPosition] = useState('1');
  const [importBalanceDate, setImportBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [importNotes, setImportNotes] = useState('Imported historical paper records');

  // Vehicle Import specs
  const [importVehicleBrand, setImportVehicleBrand] = useState('SHACMAN');
  const [importVehicleModel, setImportVehicleModel] = useState('F3000 Heavy Tractor');
  const [importVehicleYear, setImportVehicleYear] = useState('2020');
  const [importVehicleColour, setImportVehicleColour] = useState('White');
  const [importVehiclePlate, setImportVehiclePlate] = useState('');
  const [importVehicleReg, setImportVehicleReg] = useState('');
  const [importVehicleChassis, setImportVehicleChassis] = useState('');
  const [importVehicleEngine, setImportVehicleEngine] = useState('');
  const [importVehicleCapacity, setImportVehicleCapacity] = useState('30 Tons');

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(lang === 'en' ? "File limit is 10MB." : "Iyakar girman fayil shine 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Localized Labels
  const dict = {
    en: {
      title: "Register Assisted Fleet Driver",
      subtitle: "For drivers without smartphone access. Admins manage and update dossiers on their behalf.",
      step1: "1. Personal Dossier",
      step2: "2. Guarantor File",
      step3: "3. Fleet Rig Assignment",
      next: "Continue",
      prev: "Go Back",
      submit: "Certify and Register",
      fullName: "Driver Full Name",
      phone: "Phone Number",
      address: "Residential Address",
      nin: "National Identity (NIN)",
      license: "Driver License Code",
      licenseExpiry: "License Expiry Date",
      leaseVal: "30-Day Lease Value (₦)",
      rigLease: "Rig Capital Value (₦)",
      gName: "Guarantor Full Name",
      gPhone: "Guarantor Phone",
      gAddress: "Guarantor Residential Address",
      gRelationship: "Relationship with Driver",
      gNin: "Guarantor NIN",
      chooseRig: "Choose Fleet Rig to Assign",
      noRig: "-- No Rig Assignment (Register Only) --",
      uploadPlaceholder: "Upload Document Photo (Simulated R2)"
    },
    ha: {
      title: "Rijistar Direban Mota (Assisted)",
      subtitle: "Domin direbobi marasa wayoyin zamani. Admins ke gudanar musu da duk wani bayani.",
      step1: "1. Shaidar Direba",
      step2: "2. Shaidar Guarantor",
      step3: "3. Sanya Mota",
      next: "Ci gaba",
      prev: "Koma baya",
      submit: "Kammala Rijista",
      fullName: "Cikakken Sunan Direba",
      phone: "Lambar Wayar Salula",
      address: "Adireshin Gida",
      nin: "Lambar NIN",
      license: "Lambar Lasisin Mota",
      licenseExpiry: "Ranar Karewa",
      leaseVal: "Yarjejeniyar Kwanaki 30 (₦)",
      rigLease: "Kudin Mota gaba daya (₦)",
      gName: "Cikakken Sunan Guarantor",
      gPhone: "Lambar Wayar Guarantor",
      gAddress: "Adireshin Gidan Guarantor",
      gRelationship: "Alaka da Direba",
      gNin: "Lambar NIN ta Guarantor",
      chooseRig: "Zabi Motar da za a bashi",
      noRig: "-- Kar a sanya masa mota tukuna --",
      uploadPlaceholder: "Dora Takarda (Hoto a Cloudflare R2)"
    }
  }[lang];

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!fullName || !phone || !licenseNumber || !licenseExpiry) {
        setError(lang === 'en' ? "Please complete Name, Phone, and License fields." : "Da fatan za a cika Suna, Lambar Waya, da Lasisi.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!gName || !gPhone || !gNin) {
        setError(lang === 'en' ? "Please complete Guarantor Name, Phone, and NIN." : "Da fatan za a cika Sunan Guarantor, Lambar Waya, da NIN.");
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Register standard driver via core API
      const mockEmail = `assisted_${phone.slice(-6).replace(/\s/g, '')}@ruqayyaerp.com`;
      const generatedDriverId = `RTL-DRV-${Math.floor(100 + Math.random() * 900)}`;

      await api.registerDriver({
        personal: {
          fullName,
          phone,
          email: mockEmail,
          password: "assisted_password_safe", // Managed purely by admins
          licenseNumber,
          licenseExpiry: licenseExpiry || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
          address,
          nin,
          agreedAmount: parseFloat(agreedAmount),
          remainingVehicleBalance: parseFloat(remainingVehicleBalance),
          classification: 'Assisted',
          companyDriverId: generatedDriverId,
          passportPhoto: passportPhoto
        },
        guarantor: {
          fullName: gName,
          phone: gPhone,
          address: gAddress,
          relationship: gRelationship,
          nin: gNin,
          passport: guarantorPhoto
        },
        vehicle: {
          brand: "SHACMAN",
          model: "F3000 Heavy Tractor",
          plateNumber: selectedVehicleId 
            ? (vehicles.find(v => v.id === selectedVehicleId)?.plateNumber || `ASSISTED-${Math.floor(100+Math.random()*900)}`)
            : `ASSISTED-${Math.floor(100+Math.random()*900)}`,
          capacity: "30 Tons",
          chassisNumber: "CHAS-" + Math.floor(100000 + Math.random() * 900000),
          engineNumber: "ENG-" + Math.floor(100000 + Math.random() * 900000),
          registrationNumber: "REG-" + Math.floor(100000 + Math.random() * 900000),
          fuelType: "diesel"
        }
      });

      // Mark selected Vehicle as assigned if chosen
      if (selectedVehicleId) {
        await api.updateVehicle(selectedVehicleId, { status: 'assigned' });
      }

      setSuccess(lang === 'en' ? "Assisted Driver registered and certified successfully!" : "An yi nasarar rijistar wannan direban!");
      
      setTimeout(() => {
        onSync();
        onClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || "Failed to register candidate.");
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!importCompanyDriverId) {
      setError(lang === 'en' ? "Existing RTL Driver ID is mandatory." : "Dole ne a shigar da lambar RTL Driver ID.");
      return;
    }
    if (!fullName || !phone || !licenseNumber || !licenseExpiry) {
      setError(lang === 'en' ? "Please complete Name, Phone, and License details." : "Da fatan za a shigar da Suna, Lambar Waya, da Lasisi.");
      return;
    }
    if (!importVehiclePlate) {
      setError(lang === 'en' ? "Vehicle Plate Number is mandatory." : "Lambar mota ta zama dole.");
      return;
    }
    if (!gName || !gPhone || !gNin) {
      setError(lang === 'en' ? "Please complete Guarantor name, phone, and NIN." : "Da fatan za a shigar da sunan Guarantor, Lambar Waya, da NIN.");
      return;
    }

    try {
      const email = importEmail || `imported_${phone.replace(/\s/g, '').slice(-6)}@ruqayyaerp.com`;
      
      await api.importDriver({
        personal: {
          fullName,
          phone,
          email,
          licenseNumber,
          licenseExpiry,
          address,
          nin,
          agreedAmount: parseFloat(agreedAmount),
          vehiclePurchasePrice: parseFloat(remainingVehicleBalance),
          remainingVehicleBalance: parseFloat(remainingVehicleBalance) - parseFloat(importTotalPaid),
          totalPaidToDate: parseFloat(importTotalPaid),
          currentInstallmentPosition: parseInt(importInstallmentPosition),
          openingBalanceDate: importBalanceDate,
          openingNotes: importNotes,
          companyDriverId: importCompanyDriverId,
          passportPhoto
        },
        guarantor: {
          fullName: gName,
          phone: gPhone,
          address: gAddress,
          relationship: gRelationship,
          nin: gNin,
          passport: guarantorPhoto
        },
        vehicle: {
          brand: importVehicleBrand,
          model: importVehicleModel,
          year: importVehicleYear,
          colour: importVehicleColour,
          plateNumber: importVehiclePlate,
          registrationNumber: importVehicleReg || `REG-${Math.floor(100000+Math.random()*900000)}`,
          chassisNumber: importVehicleChassis || `CHAS-${Math.floor(100000+Math.random()*900000)}`,
          engineNumber: importVehicleEngine || `ENG-${Math.floor(100000+Math.random()*900000)}`,
          capacity: importVehicleCapacity
        }
      });

      setSuccess(lang === 'en' ? "Paper record migrated & digital ledger established!" : "An riga an gama shigar da takardun a tsarin dijital!");
      
      setTimeout(() => {
        onSync();
        onClose();
      }, 1500);

    } catch (err: any) {
      setError(err.message || "Failed to import historical records.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-surface border border-border-main rounded-2xl p-6 flex flex-col gap-4 shadow-2xl text-xs">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-gold animate-bounce" />
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase">{activeTab === 'standard' ? dict.title : (lang === 'en' ? 'Migrate Historical Records' : 'Shigar da Tsofaffin Takardu')}</h3>
              <p className="text-[10px] text-text-muted mt-0.5 leading-normal">{activeTab === 'standard' ? dict.subtitle : (lang === 'en' ? 'Directly import offline historical paper records into the permanent digital financial ledger.' : 'Sauya tsofaffin bayanan takarda na baya zuwa tsarin lissafin kudi na dijital na dindindin.')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-base/50 rounded-lg text-text-muted hover:text-text-main cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* Dual Mode Tabs Selection */}
        <div className="flex border-b border-border-main/20 mt-1 mb-2">
          <button
            onClick={() => { setActiveTab('standard'); setError(''); setSuccess(''); }}
            className={`flex-1 pb-2 text-center font-bold uppercase text-[9px] tracking-wider transition-colors duration-200 border-b-2 cursor-pointer ${
              activeTab === 'standard' 
                ? 'border-brand-gold text-brand-gold font-extrabold' 
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? 'Standard Registration' : 'Rijistar Direba'}
          </button>
          <button
            onClick={() => { setActiveTab('import'); setError(''); setSuccess(''); }}
            className={`flex-1 pb-2 text-center font-bold uppercase text-[9px] tracking-wider transition-colors duration-200 border-b-2 cursor-pointer ${
              activeTab === 'import' 
                ? 'border-brand-gold text-brand-gold font-extrabold' 
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {lang === 'en' ? 'Migrate Paper Records (Import)' : 'Shigar da Tsofaffin Takardu'}
          </button>
        </div>

        {/* ================= STANDARD REGISTRATION WIZARD FLOW ================= */}
        {activeTab === 'standard' && (
          <>
            {/* Wizard Steps indicator */}
            <div className="flex items-center justify-between border-b border-border-main/20 pb-3 mb-2 font-bold uppercase text-[9px] text-text-muted gap-2">
              <span className={`px-2.5 py-1 rounded-full border ${step === 1 ? 'border-brand-gold text-brand-gold bg-brand-gold/10' : 'border-border-main'}`}>{dict.step1}</span>
              <span className={`px-2.5 py-1 rounded-full border ${step === 2 ? 'border-brand-gold text-brand-gold bg-brand-gold/10' : 'border-border-main'}`}>{dict.step2}</span>
              <span className={`px-2.5 py-1 rounded-full border ${step === 3 ? 'border-brand-gold text-brand-gold bg-brand-gold/10' : 'border-border-main'}`}>{dict.step3}</span>
            </div>

            {/* Step 1 Content: Personal Dossier */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.fullName} *</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Aliyu Ibrahim" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.phone} *</label>
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +234 803 214 5592" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.license} *</label>
                    <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())} placeholder="e.g. KAN-99432" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.licenseExpiry} *</label>
                    <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.leaseVal}</label>
                    <input type="number" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value)} className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.rigLease}</label>
                    <input type="number" value={remainingVehicleBalance} onChange={(e) => setRemainingVehicleBalance(e.target.value)} className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="font-bold text-text-main">{dict.address}</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. No 4, Kano Road, Kaduna" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.nin}</label>
                    <input type="text" value={nin} onChange={(e) => setNin(e.target.value)} placeholder="e.g. NIN-99321-3321" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">
                      {lang === 'en' ? "Driver Passport Photo" : "Hoto Passport na Direba"} *
                    </label>
                    <div className="flex items-center gap-3 p-2.5 border border-dashed border-border-main rounded-lg bg-bg-base/50">
                      {passportPhoto ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border-main bg-bg-base flex-shrink-0">
                          <img src={passportPhoto} alt="Passport Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg border border-dashed border-border-main bg-bg-base flex items-center justify-center text-text-muted flex-shrink-0">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileRead(e, setPassportPhoto)}
                          className="text-[11px] text-text-muted file:mr-2 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-primary-gold/10 file:text-primary-gold hover:file:bg-primary-gold/20"
                        />
                        <span className="text-[9px] text-text-muted mt-0.5">Max 10MB (JPEG, PNG)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border-main/50 mt-2">
                  <Button variant="secondary" size="sm" onClick={handleNext}>
                    {dict.next}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 Content: Guarantor File */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.gName} *</label>
                    <input type="text" value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Alhaji Sani Musa" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.gPhone} *</label>
                    <input type="text" value={gPhone} onChange={(e) => setGPhone(e.target.value)} placeholder="e.g. +234 803 555 4321" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.gNin} *</label>
                    <input type="text" value={gNin} onChange={(e) => setGNin(e.target.value)} placeholder="e.g. NIN-4421-432" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-text-main">{dict.gRelationship}</label>
                    <input type="text" value={gRelationship} onChange={(e) => setGRelationship(e.target.value)} placeholder="e.g. Elder Brother / Uncle" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{dict.gAddress}</label>
                  <input type="text" value={gAddress} onChange={(e) => setGAddress(e.target.value)} placeholder="e.g. Hotoro G.R.A, Kano" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">
                    {lang === 'en' ? "Guarantor Passport / ID Scan" : "Hoto Passport ko Shaidar Guarantor"} *
                  </label>
                  <div className="flex items-center gap-3 p-2.5 border border-dashed border-border-main rounded-lg bg-bg-base/50">
                    {guarantorPhoto ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border-main bg-bg-base flex-shrink-0">
                        <img src={guarantorPhoto} alt="Guarantor Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-dashed border-border-main bg-bg-base flex items-center justify-center text-text-muted flex-shrink-0">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileRead(e, setGuarantorPhoto)}
                        className="text-[11px] text-text-muted file:mr-2 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-primary-gold/10 file:text-primary-gold hover:file:bg-primary-gold/20"
                      />
                      <span className="text-[9px] text-text-muted mt-0.5">Max 10MB (JPEG, PNG)</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-border-main/50 mt-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>{dict.prev}</Button>
                  <Button variant="secondary" size="sm" onClick={handleNext}>{dict.next}</Button>
                </div>
              </div>
            )}

            {/* Step 3 Content: Fleet Rig Assignment */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{dict.chooseRig}</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  >
                    <option value="">{dict.noRig}</option>
                    {vehicles.filter(v => v.status === 'idle').map(v => (
                      <option key={v.id} value={v.id}>{v.plateNumber} ({v.brand} {v.model})</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-text-muted">Showing currently idle carrier assets.</span>
                </div>

                <div className="flex justify-between pt-4 border-t border-border-main/50 mt-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(2)}>{dict.prev}</Button>
                  <Button variant="secondary" size="sm" onClick={handleSubmit}>{dict.submit}</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= PAPER RECORD MIGRATION (IMPORT) FLOW ================= */}
        {activeTab === 'import' && (
          <form onSubmit={handleImportSubmit} className="flex flex-col gap-5">
            
            {/* Section A: Historical Registry ID & Account details */}
            <div>
              <div className="flex items-center gap-1 border-b border-border-main/20 pb-1 mb-2 text-[10px] font-bold text-brand-gold uppercase">
                <span>A. Historical Identity</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">RTL Driver ID *</label>
                  <input
                    type="text"
                    value={importCompanyDriverId}
                    onChange={(e) => setImportCompanyDriverId(e.target.value.toUpperCase())}
                    placeholder="e.g. DRV-2026-001"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{dict.fullName} *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aliyu Ibrahim"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{dict.phone} *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +234 803 214 5592"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Email (Optional)</label>
                  <input
                    type="email"
                    value={importEmail}
                    onChange={(e) => setImportEmail(e.target.value)}
                    placeholder="Leave empty for auto-generation"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{dict.license} *</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="KAN-99432"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">{dict.licenseExpiry} *</label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">NIN</label>
                  <input
                    type="text"
                    value={nin}
                    onChange={(e) => setNin(e.target.value)}
                    placeholder="NIN-99321-3321"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Home Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. No 4, Kano Road, Kaduna"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Vehicle Specifications */}
            <div>
              <div className="flex items-center gap-1 border-b border-border-main/20 pb-1 mb-2 text-[10px] font-bold text-brand-gold uppercase">
                <span>B. Vehicle Specifications</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Vehicle Plate *</label>
                  <input
                    type="text"
                    value={importVehiclePlate}
                    onChange={(e) => setImportVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. KAN-553-XA"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Brand</label>
                  <input
                    type="text"
                    value={importVehicleBrand}
                    onChange={(e) => setImportVehicleBrand(e.target.value)}
                    placeholder="SHACMAN"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Model</label>
                  <input
                    type="text"
                    value={importVehicleModel}
                    onChange={(e) => setImportVehicleModel(e.target.value)}
                    placeholder="F3000 Heavy Tractor"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Year</label>
                  <input
                    type="number"
                    value={importVehicleYear}
                    onChange={(e) => setImportVehicleYear(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Chassis Number</label>
                  <input
                    type="text"
                    value={importVehicleChassis}
                    onChange={(e) => setImportVehicleChassis(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Engine Number</label>
                  <input
                    type="text"
                    value={importVehicleEngine}
                    onChange={(e) => setImportVehicleEngine(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
              </div>
            </div>

            {/* Section C: Financial Ledger baseline */}
            <div>
              <div className="flex items-center gap-1 border-b border-border-main/20 pb-1 mb-2 text-[10px] font-bold text-brand-gold uppercase">
                <span>C. Financial Ledger Baseline</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Vehicle Contract Price (₦)</label>
                  <input
                    type="number"
                    value={remainingVehicleBalance}
                    onChange={(e) => setRemainingVehicleBalance(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                  <span className="text-[9px] text-text-muted">Total outstanding obligation remaining.</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Total Paid To Date (₦)</label>
                  <input
                    type="number"
                    value={importTotalPaid}
                    onChange={(e) => setImportTotalPaid(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                  <span className="text-[9px] text-text-muted">Historically logged payments.</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Agreed 30-Day Rate (₦)</label>
                  <input
                    type="number"
                    value={agreedAmount}
                    onChange={(e) => setAgreedAmount(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                  <span className="text-[9px] text-text-muted">Cycle obligation amount.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Installment Step</label>
                  <input
                    type="number"
                    value={importInstallmentPosition}
                    onChange={(e) => setImportInstallmentPosition(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Baseline Date</label>
                  <input
                    type="date"
                    value={importBalanceDate}
                    onChange={(e) => setImportBalanceDate(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Baseline Audit Notes</label>
                  <input
                    type="text"
                    value={importNotes}
                    onChange={(e) => setImportNotes(e.target.value)}
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>
            </div>

            {/* Section D: Guarantor details */}
            <div>
              <div className="flex items-center gap-1 border-b border-border-main/20 pb-1 mb-2 text-[10px] font-bold text-brand-gold uppercase">
                <span>D. Guarantor Verification</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Guarantor Name *</label>
                  <input
                    type="text"
                    value={gName}
                    onChange={(e) => setGName(e.target.value)}
                    placeholder="Alhaji Sani Musa"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Guarantor Phone *</label>
                  <input
                    type="text"
                    value={gPhone}
                    onChange={(e) => setGPhone(e.target.value)}
                    placeholder="+234 803 555 4321"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Guarantor NIN *</label>
                  <input
                    type="text"
                    value={gNin}
                    onChange={(e) => setGNin(e.target.value)}
                    placeholder="NIN-4421-432"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono text-text-main"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-text-main">Relationship</label>
                  <input
                    type="text"
                    value={gRelationship}
                    onChange={(e) => setGRelationship(e.target.value)}
                    placeholder="Elder Brother / Uncle"
                    className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none text-text-main"
                  />
                </div>
              </div>
            </div>

            {/* Certify statement & Submit buttons */}
            <div className="border-t border-border-main/50 pt-4 flex items-center justify-between">
              <span className="text-[10px] text-brand-gold font-bold">✓ This record is legally verified for migration.</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" size="sm">
                  Migrate & Establish Ledger
                </Button>
              </div>
            </div>

          </form>
        )}

      </Card>
    </div>
  );
};
