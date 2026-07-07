/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Truck, 
  ShieldCheck, 
  Map, 
  Phone, 
  Mail, 
  Lock, 
  UserPlus, 
  AlertCircle, 
  FileText, 
  User, 
  Users, 
  Car, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Dictionary, Language } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/SharedComponents';
import { api } from '../utils/api';

interface LandingPageProps {
  dictionary: Dictionary;
  lang: Language;
  onLoginAsDriver: (fullName: string) => void;
  onNavigateToRole: (role: 'driver' | 'admin' | 'director' | 'shareholder') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  dictionary,
  lang,
  onLoginAsDriver,
  onNavigateToRole
}) => {
  const [activePortal, setActivePortal] = useState<'login' | 'register'>('login');
  
  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Multi-step Registration Wizard State
  const [regStep, setRegStep] = useState<1 | 2 | 3 | 4>(1); // 1: Personal, 2: Guarantor, 3: Vehicle, 4: Complete
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // Personal Information State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [nin, setNin] = useState('');
  const [password, setPassword] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [passportPhoto, setPassportPhoto] = useState('');

  // Guarantor Information State
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [guarantorAddress, setGuarantorAddress] = useState('');
  const [guarantorRelationship, setGuarantorRelationship] = useState('');
  const [guarantorNin, setGuarantorNin] = useState('');
  const [guarantorPassport, setGuarantorPassport] = useState('');

  // Vehicle Information State
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('2022');
  const [vehicleColour, setVehicleColour] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleRegNo, setVehicleRegNo] = useState('');
  const [vehicleChassis, setVehicleChassis] = useState('');
  const [vehicleEngine, setVehicleEngine] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('30 Tons');

  // File Upload Helper to Base64 Conversion
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setRegError(lang === 'en' ? "File is too large (maximum limit 5MB)." : "Fayil ɗin ya yi girma da yawa (iyaka 5MB).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess(false);
    
    if (!loginEmail || !loginPassword) {
      setLoginError(lang === 'en' ? "Please complete all validation parameters." : "Da fatan za a cika duka bayanan.");
      return;
    }

    try {
      const res = await api.login({
        email: loginEmail,
        password: loginPassword,
        rememberMe
      });

      setLoginSuccess(true);
      setTimeout(() => {
        if (res.user.role === 'driver') {
          onLoginAsDriver(res.user.fullName);
        } else {
          onNavigateToRole(res.user.role);
        }
      }, 1000);
    } catch (err: any) {
      setLoginError(err.message || "Failed to authenticate.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess(false);

    // Validation
    if (!vehicleBrand || !vehicleModel || !vehiclePlate || !vehicleRegNo || !vehicleChassis || !vehicleEngine) {
      setRegError(lang === 'en' ? "All carrier vehicle specifications are mandatory." : "Duk bayanan motar sufuri suna da mahimmanci.");
      return;
    }

    try {
      await api.registerDriver({
        personal: {
          fullName,
          phone,
          email,
          address,
          nin,
          password,
          licenseNumber,
          licenseExpiry,
          passportPhoto
        },
        guarantor: {
          fullName: guarantorName,
          phone: guarantorPhone,
          address: guarantorAddress,
          relationship: guarantorRelationship,
          nin: guarantorNin,
          passport: guarantorPassport
        },
        vehicle: {
          brand: vehicleBrand,
          model: vehicleModel,
          year: vehicleYear,
          colour: vehicleColour,
          plateNumber: vehiclePlate,
          registrationNumber: vehicleRegNo,
          chassisNumber: vehicleChassis,
          engineNumber: vehicleEngine,
          capacity: vehicleCapacity
        }
      });

      setRegSuccess(true);
      setRegStep(4); // Advance to completion screen
      
      // Clear forms
      setFullName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNin('');
      setPassword('');
      setLicenseNumber('');
      setGuarantorName('');
      setGuarantorPhone('');
      setGuarantorAddress('');
      setVehiclePlate('');
      setVehicleModel('');
    } catch (err: any) {
      setRegError(err.message || "Registration processing failed.");
    }
  };

  const nextStep = () => {
    setRegError('');
    if (regStep === 1) {
      if (!fullName || !phone || !email || !address || !nin || !password) {
        setRegError(lang === 'en' ? "Please compile all personal profile parameters." : "Da fatan za a cika duka bayanan sirri.");
        return;
      }
      setRegStep(2);
    } else if (regStep === 2) {
      if (!guarantorName || !guarantorPhone || !guarantorAddress || !guarantorRelationship || !guarantorNin) {
        setRegError(lang === 'en' ? "All guarantor fields are mandatory." : "Duk bayanan mai tsayawa suna da mahimmanci.");
        return;
      }
      setRegStep(3);
    }
  };

  const prevStep = () => {
    setRegError('');
    if (regStep > 1) {
      setRegStep((prev) => (prev - 1) as any);
    }
  };

  const servicesList = [
    {
      icon: <Truck className="h-6 w-6 text-brand-gold" />,
      titleEn: "Heavy Tonnage Haulage",
      titleHa: "Jigilar Kaya Masu Nauyi",
      descEn: "Long-haul freight transport specializing in construction aggregate, dry agro-bulk commodities, and mining cargo.",
      descHa: "Sufuri mai nisa na kayan gini, kayan gona masu yawa, da kayan ma'adinai."
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-emerald-500" />,
      titleEn: "Corporate Transit Logistics",
      titleHa: "Kayan Aiki Na Tsaro",
      descEn: "High-security transport corridors backed by live tracking, telemetry logging, and robust security escorts.",
      descHa: "Hanyoyin sufuri masu tsaro sosai tare da bin diddigin motoci a kowane lokaci."
    },
    {
      icon: <Map className="h-6 w-6 text-blue-500" />,
      titleEn: "Regional Distribution Contracts",
      titleHa: "Kwangilolin Rarraba Kaya",
      descEn: "Reliable distribution logistics contracts servicing multinational manufacturers across major West African trade corridors.",
      descHa: "Rarraba kayayyaki don manyan masana'antu a duk faɗin yammacin Afirka."
    }
  ];

  return (
    <div className="flex-1 bg-bg-base text-text-main flex flex-col min-h-screen">
      {/* Top Banner & Corporate Disclaimer */}
      <div className="bg-brand-navy text-white text-[11px] font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 border-b border-slate-800">
        <Lock className="h-3 w-3 text-brand-gold" />
        <span>{dictionary.landing.portalNotice}</span>
      </div>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white py-12 px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Hero Branding */}
          <div className="lg:col-span-7 flex flex-col gap-6 lg:pt-8">
            <span className="bg-slate-900 text-brand-gold border border-slate-800 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest self-start uppercase">
              RUQAYYA TRANSPORT LIMITED
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-white">
              {dictionary.landing.heroTitle}
            </h1>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl">
              {dictionary.landing.heroSubtitle}
            </p>

            {/* Core Operational Statistics GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <span className="block text-xl font-extrabold text-brand-gold">150+</span>
                <span className="text-[11px] text-slate-400 font-medium">{dictionary.landing.statsDrivers}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <span className="block text-xl font-extrabold text-brand-gold">85+</span>
                <span className="text-[11px] text-slate-400 font-medium">{dictionary.landing.statsVehicles}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <span className="block text-xl font-extrabold text-brand-gold">14,200+</span>
                <span className="text-[11px] text-slate-400 font-medium">{dictionary.landing.statsTrips}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <span className="block text-xl font-extrabold text-brand-gold">36+</span>
                <span className="text-[11px] text-slate-400 font-medium">{dictionary.landing.statsCoverage}</span>
              </div>
            </div>
          </div>

          {/* Secure Interactive Access Portal Panel */}
          <div className="lg:col-span-5 w-full">
            <Card className="bg-slate-900/60 border-slate-800 text-white shadow-2xl p-6 rounded-2xl">
              <div className="flex border-b border-slate-800 mb-6 bg-slate-950/50 p-1 rounded-lg gap-1">
                <button
                  onClick={() => { setActivePortal('login'); setRegStep(1); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    activePortal === 'login'
                      ? 'bg-brand-navy text-brand-gold border border-slate-850 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {dictionary.landing.driverLogin}
                </button>
                <button
                  onClick={() => { setActivePortal('register'); setRegStep(1); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    activePortal === 'register'
                      ? 'bg-brand-navy text-brand-gold border border-slate-850 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {dictionary.landing.driverRegister}
                </button>
              </div>

              {activePortal === 'login' ? (
                // Unified Secure Login Form
                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      {lang === 'en' ? "Corporate Portal Access" : "Hanyar Shiga Tsarin"}
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {lang === 'en' 
                        ? "Enter your registered email and secure password to authenticate."
                        : "Shigar da imel dinka da kalmar sirri don shiga tsarin sufuri."}
                    </p>
                  </div>

                  {loginError && <Alert type="danger">{loginError}</Alert>}
                  {loginSuccess && <Alert type="success">{lang === 'en' ? "Session Authorized. Mounting Roster..." : "An Tabbatar. Ana buɗe shafin..."}</Alert>}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-300">
                      {dictionary.forms.email}
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. musa.garba@ruqayyatransport.com"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-brand-gold placeholder:text-slate-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-300">
                        {lang === 'en' ? "Password" : "Kalmar Sirri"}
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3 pr-10 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-brand-gold placeholder:text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-brand-gold focus:ring-0"
                      />
                      <span>{lang === 'en' ? "Remember Me" : "Tuna da ni"}</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Session expiration active</span>
                  </div>

                  <Button variant="secondary" type="submit" size="sm" className="w-full mt-3 font-bold cursor-pointer">
                    {lang === 'en' ? "Secure Login" : "Shiga Tsarin"}
                  </Button>
                </form>
              ) : (
                // Comprehensive 3-Step Driver Self-Registration Form
                <div className="flex flex-col gap-4">
                  {/* Step Header Indicator */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-brand-gold">
                      {lang === 'en' ? `STEP ${regStep} of 3` : `MATAKI ${regStep} daga 3`}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {regStep === 1 && (lang === 'en' ? "Personal Info" : "Bayanan Sirri")}
                      {regStep === 2 && (lang === 'en' ? "Guarantor Details" : "Bayanan Guarantor")}
                      {regStep === 3 && (lang === 'en' ? "Carrier Vehicle" : "Motar Sufuri")}
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                    <div 
                      className="bg-brand-gold h-full transition-all duration-300" 
                      style={{ width: `${(regStep / 3) * 100}%` }}
                    />
                  </div>

                  {regError && <Alert type="danger">{regError}</Alert>}

                  {/* STEP 1: Personal Profile */}
                  {regStep === 1 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">{lang === 'en' ? "Full Name (as in DL/NIN)" : "Cikakken Suna"}</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Alhaji Musa Garba"
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">{dictionary.forms.phone}</label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+234..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">National NIN</label>
                          <input
                            type="text"
                            required
                            maxLength={11}
                            value={nin}
                            onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
                            placeholder="11-digit number"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Email Address</label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="musa@example.com"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Password</label>
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">Residential Address</label>
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. 14 Zaria Road, Kano"
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">License Number</label>
                          <input
                            type="text"
                            required
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                            placeholder="NGA-DL-XXXXXX"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">License Expiry</label>
                          <input
                            type="date"
                            required
                            value={licenseExpiry}
                            onChange={(e) => setLicenseExpiry(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">Passport Photo (Required)</label>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={(e) => handleFileChange(e, setPassportPhoto)}
                          className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-white cursor-pointer"
                        />
                      </div>

                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={nextStep} 
                        className="w-full font-bold flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                      >
                        {lang === 'en' ? "Continue to Guarantor" : "Tafi Zuwa Guarantor"}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* STEP 2: Guarantor details */}
                  {regStep === 2 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">Guarantor Full Name</label>
                        <input
                          type="text"
                          required
                          value={guarantorName}
                          onChange={(e) => setGuarantorName(e.target.value)}
                          placeholder="e.g. Alhaji Garba Haruna"
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Guarantor Telephone</label>
                          <input
                            type="tel"
                            required
                            value={guarantorPhone}
                            onChange={(e) => setGuarantorPhone(e.target.value)}
                            placeholder="e.g. +234..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Relationship Type</label>
                          <input
                            type="text"
                            required
                            value={guarantorRelationship}
                            onChange={(e) => setGuarantorRelationship(e.target.value)}
                            placeholder="e.g. Uncle, Brother"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Guarantor NIN</label>
                          <input
                            type="text"
                            required
                            maxLength={11}
                            value={guarantorNin}
                            onChange={(e) => setGuarantorNin(e.target.value.replace(/\D/g, ''))}
                            placeholder="11-digit NIN"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">Guarantor Full Address</label>
                        <input
                          type="text"
                          required
                          value={guarantorAddress}
                          onChange={(e) => setGuarantorAddress(e.target.value)}
                          placeholder="e.g. 22 Airport Road, Kano"
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300">Guarantor Passport (Required)</label>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={(e) => handleFileChange(e, setGuarantorPassport)}
                          className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-white cursor-pointer"
                        />
                      </div>

                      <div className="flex gap-3 mt-2">
                        <button 
                          type="button" 
                          onClick={prevStep}
                          className="flex-1 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          {lang === 'en' ? "Back" : "Koma"}
                        </button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={nextStep} 
                          className="flex-1 font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {lang === 'en' ? "Continue" : "Gaba"}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Vehicle details */}
                  {regStep === 3 && (
                    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Brand / Make</label>
                          <input
                            type="text"
                            required
                            value={vehicleBrand}
                            onChange={(e) => setVehicleBrand(e.target.value)}
                            placeholder="e.g. Mercedes-Benz"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Vehicle Model</label>
                          <input
                            type="text"
                            required
                            value={vehicleModel}
                            onChange={(e) => setVehicleModel(e.target.value)}
                            placeholder="e.g. Actros 3340"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 col-span-1">
                          <label className="text-[11px] font-bold text-slate-300">Year</label>
                          <input
                            type="text"
                            required
                            value={vehicleYear}
                            onChange={(e) => setVehicleYear(e.target.value)}
                            placeholder="2022"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 col-span-1">
                          <label className="text-[11px] font-bold text-slate-300">Colour</label>
                          <input
                            type="text"
                            required
                            value={vehicleColour}
                            onChange={(e) => setVehicleColour(e.target.value)}
                            placeholder="White"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 col-span-1">
                          <label className="text-[11px] font-bold text-slate-300">Capacity</label>
                          <select
                            value={vehicleCapacity}
                            onChange={(e) => setVehicleCapacity(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          >
                            <option value="30 Tons">30 Tons</option>
                            <option value="40 Tons">40 Tons</option>
                            <option value="45 Tons">45 Tons</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Plate Number</label>
                          <input
                            type="text"
                            required
                            value={vehiclePlate}
                            onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                            placeholder="e.g. KANO-432-KN"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Reg Number</label>
                          <input
                            type="text"
                            required
                            value={vehicleRegNo}
                            onChange={(e) => setVehicleRegNo(e.target.value)}
                            placeholder="REG-MB-9921"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Chassis Number</label>
                          <input
                            type="text"
                            required
                            value={vehicleChassis}
                            onChange={(e) => setVehicleChassis(e.target.value)}
                            placeholder="WDB934032..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300">Engine Number</label>
                          <input
                            type="text"
                            required
                            value={vehicleEngine}
                            onChange={(e) => setVehicleEngine(e.target.value)}
                            placeholder="OM501LA..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2">
                        <button 
                          type="button" 
                          onClick={prevStep}
                          className="flex-1 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          {lang === 'en' ? "Back" : "Koma"}
                        </button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          type="submit"
                          className="flex-1 font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {lang === 'en' ? "Complete Register" : "Kammala Rijistar"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* STEP 4: Registration complete / Review state */}
                  {regStep === 4 && (
                    <div className="text-center py-6 flex flex-col items-center gap-4 text-white">
                      <CheckCircle className="h-14 w-14 text-emerald-500 animate-bounce" />
                      <div>
                        <h4 className="text-base font-extrabold text-white">
                          {lang === 'en' ? "Registration Submitted!" : "An Shigar Da Rijistar Ka!"}
                        </h4>
                        <p className="text-xs text-slate-450 leading-relaxed mt-2 px-3">
                          {lang === 'en' 
                            ? "Your corporate driver candidate file is queued. A security auditor is reviewing your NIN, license, and guarantor. We will contact you upon decision."
                            : "Takardun ku suna jiran tantancewa daga Admin. Za mu sanar da ku idan mun kammala."}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setActivePortal('login'); setRegStep(1); }}
                        className="font-bold border-slate-800 hover:bg-slate-800 mt-2 text-white cursor-pointer"
                      >
                        {lang === 'en' ? "Go to Login Portal" : "Koma shafin Shiga"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full flex-1">
        <div className="text-center mb-12 flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-text-main">
            {dictionary.landing.servicesTitle}
          </h2>
          <p className="text-text-muted text-xs">
            {dictionary.landing.servicesSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {servicesList.map((srv, idx) => (
            <Card key={idx} hoverEffect className="flex flex-col gap-4">
              <div className="p-3 bg-brand-gold/10 self-start rounded-xl">
                {srv.icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-main mb-1">
                  {lang === 'en' ? srv.titleEn : srv.titleHa}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {lang === 'en' ? srv.descEn : srv.descHa}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Corporate Profile Card */}
        <div className="mt-16 bg-bg-surface border border-border-main rounded-2xl p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xs">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-text-main">
              {dictionary.landing.aboutTitle}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {dictionary.landing.aboutText}
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col gap-3 bg-bg-base/30 p-5 rounded-xl border border-border-main/50">
            <h4 className="text-xs font-bold text-text-main flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              {lang === 'en' ? "Standards Compliance" : "Amincewa Da Dokoki"}
            </h4>
            <div className="flex flex-col gap-1 text-[11px] text-text-muted">
              <p>• FRSC Highway Safety Standards certified</p>
              <p>• Clean ECOWAS trans-border transport permit</p>
              <p>• Full heavy carriage asset insurance packages</p>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Contact Info */}
      <section className="bg-bg-surface border-t border-border-main py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-text-muted">
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-text-main text-sm">{dictionary.landing.contactUs}</h4>
            <p>12 Alhaji Kabiru Road, Bompai Industrial Estate,</p>
            <p>Kano State, Nigeria.</p>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-text-main text-sm">{lang === 'en' ? "Direct Dispatch Desk" : "Sufuri Kai Tsaye"}</h4>
            <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-brand-gold" /> +234 803 123 4567</p>
            <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-brand-gold" /> logistics@ruqayyatransport.com</p>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-text-main text-sm">{lang === 'en' ? "Operations Security" : "Tsaron Gudanarwa"}</h4>
            <p>Certified by the Nigerian Transport regulatory bodies for industrial haulage and secure supply chains across ECOWAS.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-[11px] text-center py-6 border-t border-slate-900 px-6">
        <p>{dictionary.landing.footerText}</p>
      </footer>
    </div>
  );
};
