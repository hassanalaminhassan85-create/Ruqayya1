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
  // Navigation / Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step 1 Form States: Personal Dossier
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nin, setNin] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [agreedAmount, setAgreedAmount] = useState('300000'); // Default 30-Day Rate
  const [remainingVehicleBalance, setRemainingVehicleBalance] = useState('15000000'); // Default Rig Lease Cost

  // Step 2 Form States: Guarantor Profile
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gAddress, setGAddress] = useState('');
  const [gRelationship, setGRelationship] = useState('');
  const [gNin, setGNin] = useState('');

  // Step 3 Form States: Fleet Rig Allocation
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  
  // Simulated File Upload states (Using generic mock URLs for testing R2 upload logic)
  const [passportPhoto, setPassportPhoto] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200');
  const [guarantorPhoto, setGuarantorPhoto] = useState('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200');
  const [ninCard, setNinCard] = useState('https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&q=80&w=200');

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
      // 1. Register driver via core API (Admins authenticate this request)
      const mockEmail = `assisted_${phone.slice(-6)}@ruqayyaerp.com`;
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

      // 2. Mark selected Vehicle as assigned if chosen
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-bg-surface border border-border-main rounded-2xl p-6 flex flex-col gap-4 shadow-2xl text-xs">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-gold animate-bounce" />
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase">{dict.title}</h3>
              <p className="text-[10px] text-text-muted mt-0.5 leading-normal">{dict.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-base/50 rounded-lg text-text-muted hover:text-text-main cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <Alert type="danger">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

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
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Aliyu Ibrahim" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.phone} *</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +234 803 214 5592" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.license} *</label>
                <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())} placeholder="e.g. KAN-99432" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.licenseExpiry} *</label>
                <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.leaseVal}</label>
                <input type="number" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value)} className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.rigLease}</label>
                <input type="number" value={remainingVehicleBalance} onChange={(e) => setRemainingVehicleBalance(e.target.value)} className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 col-span-2">
                <label className="font-bold text-text-main">{dict.address}</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. No 4, Kano Road, Kaduna" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.nin}</label>
                <input type="text" value={nin} onChange={(e) => setNin(e.target.value)} placeholder="e.g. NIN-99321-3321" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono" />
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
                <input type="text" value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Alhaji Sani Musa" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.gPhone} *</label>
                <input type="text" value={gPhone} onChange={(e) => setGPhone(e.target.value)} placeholder="e.g. +234 803 555 4321" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.gNin} *</label>
                <input type="text" value={gNin} onChange={(e) => setGNin(e.target.value)} placeholder="e.g. NIN-4421-432" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none font-mono" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-text-main">{dict.gRelationship}</label>
                <input type="text" value={gRelationship} onChange={(e) => setGRelationship(e.target.value)} placeholder="e.g. Elder Brother / Uncle" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-text-main">{dict.gAddress}</label>
              <input type="text" value={gAddress} onChange={(e) => setGAddress(e.target.value)} placeholder="e.g. Hotoro G.R.A, Kano" className="px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none" />
            </div>

            <div className="flex justify-between pt-4 border-t border-border-main/50 mt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>{dict.prev}</Button>
              <Button variant="secondary" size="sm" onClick={handleNext}>{dict.next}</Button>
            </div>
          </div>
        )}

        {/* Step 3 Content: Fleet Rig Assignment & Uploads */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-text-main">{dict.chooseRig}</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-base border border-border-main rounded-lg focus:outline-none"
              >
                <option value="">{dict.noRig}</option>
                {vehicles.filter(v => v.status === 'idle').map(v => (
                  <option key={v.id} value={v.id}>{v.plateNumber} ({v.brand} {v.model})</option>
                ))}
              </select>
              <span className="text-[10px] text-text-muted">Showing currently idle carrier assets.</span>
            </div>

            {/* Document lockers upload */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <Card className="p-3 border border-dashed border-border-main/80 flex flex-col items-center justify-center text-center gap-1.5 bg-bg-base/10">
                <UploadCloud className="h-5 w-5 text-text-muted" />
                <span className="font-bold text-[9px] text-text-main">Passport Photograph</span>
                <span className="text-[8px] text-text-muted">Certified jpeg max 5mb</span>
              </Card>

              <Card className="p-3 border border-dashed border-border-main/80 flex flex-col items-center justify-center text-center gap-1.5 bg-bg-base/10">
                <UploadCloud className="h-5 w-5 text-text-muted" />
                <span className="font-bold text-[9px] text-text-main">License & NIN Slips</span>
                <span className="text-[8px] text-text-muted">Clear scanner copy pdf</span>
              </Card>

              <Card className="p-3 border border-dashed border-border-main/80 flex flex-col items-center justify-center text-center gap-1.5 bg-bg-base/10">
                <UploadCloud className="h-5 w-5 text-text-muted" />
                <span className="font-bold text-[9px] text-text-main">Guarantor Document</span>
                <span className="text-[8px] text-text-muted">Affidavit notarized file</span>
              </Card>
            </div>

            <div className="flex justify-between pt-4 border-t border-border-main/50 mt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>{dict.prev}</Button>
              <Button variant="secondary" size="sm" onClick={handleSubmit}>{dict.submit}</Button>
            </div>
          </div>
        )}

      </Card>
    </div>
  );
};
