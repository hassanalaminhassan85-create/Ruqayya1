/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import { CircularLogo } from '../components/CircularLogo';

interface FloatingInputProps {
  type: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  rightElement?: React.ReactNode;
}

const FloatingInput: React.FC<FloatingInputProps> = ({
  type,
  label,
  value,
  onChange,
  icon,
  placeholder = " ",
  required,
  maxLength,
  rightElement
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined && value !== null && value.toString().length > 0;

  return (
    <div className="relative flex flex-col w-full">
      <div 
        className={`relative flex items-center w-full h-[58px] rounded-xl border transition-all duration-300 bg-slate-950/45 backdrop-blur-md ${
          isFocused 
            ? 'border-brand-gold ring-2 ring-brand-gold/20 shadow-[0_0_15px_rgba(212,163,89,0.15)] bg-slate-900/60' 
            : 'border-slate-800/80 hover:border-slate-700/80'
        }`}
      >
        <div className={`absolute left-4 transition-colors duration-300 shrink-0 ${isFocused ? 'text-brand-gold' : 'text-slate-500'}`}>
          {icon}
        </div>

        <input
          type={type}
          required={required}
          maxLength={maxLength}
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={onChange}
          placeholder={isFocused ? placeholder : " "}
          className="w-full h-full pl-12 pr-12 pt-4 pb-1 text-xs bg-transparent border-0 text-white focus:outline-none focus:ring-0 placeholder:text-slate-700 font-medium"
        />

        <label
          className={`absolute left-12 pointer-events-none transition-all duration-300 ease-out text-xs font-semibold ${
            isFocused || hasValue
              ? 'top-2.5 text-[10px] text-brand-gold/90 font-bold uppercase tracking-wider'
              : 'top-1/2 -translate-y-1/2 text-slate-400 text-[11px]'
          }`}
        >
          {label}
        </label>

        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
};

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

  return (
    <div className="flex-1 bg-bg-base text-text-main flex flex-col min-h-screen">
      {/* Top Banner & Corporate Disclaimer */}
      <div className="bg-brand-navy text-white text-[11px] font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 border-b border-slate-800">
        <Lock className="h-3 w-3 text-brand-gold" />
        <span>{dictionary.landing.portalNotice}</span>
      </div>

      {/* Unified Hero & Authentication Access Portal */}
      <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white pt-14 pb-20 px-4 md:px-6 border-b border-slate-800 flex flex-col items-center justify-center gap-10 w-full">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 text-center">
          <span className="bg-slate-900/80 text-brand-gold border border-slate-800 px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-xs">
            RUQAYYA TRANSPORT LIMITED
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white font-sans">
            {dictionary.landing.heroTitle}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm leading-relaxed max-w-xl font-sans px-2">
            {dictionary.landing.heroSubtitle}
          </p>
        </div>

        <div className="w-full max-w-2xl px-1">
          {/* Glassmorphic Portal Card */}
          <Card className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 text-white shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-6 md:p-8 rounded-[24px] flex flex-col gap-6 w-full">
            
            {/* Integrated Header */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-5">
              <div className="flex items-center gap-3">
                <CircularLogo size="md" className="shadow-lg shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-black tracking-wider text-white font-mono leading-none">
                    RUQAYYA ERP
                  </span>
                  <span className="text-[10px] font-bold text-brand-gold tracking-widest uppercase mt-1.5">
                    OPERATIONS HUB
                  </span>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-[9px] text-slate-500 font-mono uppercase bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/60 font-bold tracking-wider">
                  Secure Portal • SSL ACTIVE
                </span>
              </div>
            </div>

            {/* Premium Segmented Control with smooth sliding indicator */}
            <div className="relative flex bg-slate-950/80 border border-slate-850 p-1.5 rounded-xl gap-1 w-full overflow-hidden">
              {/* sliding indicator */}
              <motion.div
                className="absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-r from-brand-navy to-slate-900 border border-slate-800/60 shadow-lg"
                initial={false}
                animate={{
                  left: activePortal === 'login' ? '6px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 8px)',
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />

              <button
                onClick={() => { setActivePortal('login'); setRegStep(1); }}
                className={`relative flex-1 py-3 text-xs font-black rounded-lg transition-colors duration-200 z-10 flex items-center justify-center gap-2 cursor-pointer ${
                  activePortal === 'login' ? 'text-brand-gold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{dictionary.landing.driverLogin}</span>
              </button>
              <button
                onClick={() => { setActivePortal('register'); setRegStep(1); }}
                className={`relative flex-1 py-3 text-xs font-black rounded-lg transition-colors duration-200 z-10 flex items-center justify-center gap-2 cursor-pointer ${
                  activePortal === 'register' ? 'text-brand-gold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{dictionary.landing.driverRegister}</span>
              </button>
            </div>

            {activePortal === 'login' ? (
              // Unified Secure Login Form
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-black text-white mb-1 uppercase tracking-wider text-brand-gold">
                    {lang === 'en' ? "Corporate Portal Access" : "Hanyar Shiga Tsarin"}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    {lang === 'en' 
                      ? "Enter your registered email and secure password to authenticate."
                      : "Shigar da imel dinka da kalmar sirri don shiga tsarin sufuri."}
                  </p>
                </div>

                {loginError && <Alert type="danger">{loginError}</Alert>}
                {loginSuccess && <Alert type="success">{lang === 'en' ? "Session Authorized. Mounting Roster..." : "An Tabbatar. Ana buɗe shafin..."}</Alert>}

                <div className="flex flex-col gap-4">
                  <FloatingInput
                    type="email"
                    label={dictionary.forms.email}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    icon={<Mail className="h-4.5 w-4.5" />}
                    placeholder="e.g. musa.garba@ruqayyatransport.com"
                    required
                  />

                  <FloatingInput
                    type={showPassword ? 'text' : 'password'}
                    label={lang === 'en' ? "Password" : "Kalmar Sirri"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    icon={<Lock className="h-4.5 w-4.5" />}
                    placeholder="••••••••"
                    required
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </div>

                <div className="flex items-center justify-between mt-1">
                  <label className="flex items-center gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-brand-gold focus:ring-0 h-4 w-4 cursor-pointer"
                    />
                    <span>{lang === 'en' ? "Remember Me" : "Tuna da ni"}</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Session Protected</span>
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button variant="secondary" type="submit" size="sm" className="w-full mt-2 font-black cursor-pointer py-3.5 bg-brand-gold text-slate-950 hover:bg-brand-gold/90 transition-all rounded-xl text-xs uppercase tracking-widest">
                    {lang === 'en' ? "Secure Login" : "Shiga Tsarin"}
                  </Button>
                </motion.div>
              </form>
            ) : (
              // Comprehensive 3-Step Driver Self-Registration Form
              <div className="flex flex-col gap-5">
                {/* Step Header Indicator */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-brand-gold uppercase tracking-widest">
                    {lang === 'en' ? `STEP ${regStep} of 3` : `MATAKI ${regStep} daga 3`}
                  </span>
                  <span className="text-[11px] font-black uppercase text-slate-300 font-mono">
                    {regStep === 1 && (lang === 'en' ? "Personal Info" : "Bayanan Sirri")}
                    {regStep === 2 && (lang === 'en' ? "Guarantor Details" : "Bayanan Guarantor")}
                    {regStep === 3 && (lang === 'en' ? "Carrier Vehicle" : "Motar Sufuri")}
                  </span>
                </div>

                {/* Progress Line */}
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                  <motion.div 
                    className="bg-brand-gold h-full" 
                    initial={{ width: 0 }}
                    animate={{ width: `${(regStep / 3) * 100}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>

                {regError && <Alert type="danger">{regError}</Alert>}

                {/* STEP 1: Personal Profile */}
                {regStep === 1 && (
                  <div className="flex flex-col gap-4">
                    <FloatingInput
                      type="text"
                      label={lang === 'en' ? "Full Name (as in DL/NIN)" : "Cikakken Suna"}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      icon={<User className="h-4.5 w-4.5" />}
                      placeholder="e.g. Alhaji Musa Garba"
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="tel"
                        label={dictionary.forms.phone}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        icon={<Phone className="h-4.5 w-4.5" />}
                        placeholder="+234..."
                        required
                      />

                      <FloatingInput
                        type="text"
                        label="National NIN"
                        value={nin}
                        onChange={(e) => setNin(e.target.value.replace(/\D/g, ''))}
                        icon={<ShieldCheck className="h-4.5 w-4.5" />}
                        placeholder="11-digit number"
                        maxLength={11}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="email"
                        label="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<Mail className="h-4.5 w-4.5" />}
                        placeholder="musa@example.com"
                        required
                      />

                      <FloatingInput
                        type="password"
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock className="h-4.5 w-4.5" />}
                        placeholder="Min 6 characters"
                        required
                      />
                    </div>

                    <FloatingInput
                      type="text"
                      label="Residential Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      icon={<Map className="h-4.5 w-4.5" />}
                      placeholder="e.g. 14 Zaria Road, Kano"
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="text"
                        label="License Number"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                        icon={<FileText className="h-4.5 w-4.5" />}
                        placeholder="NGA-DL-XXXXXX"
                        required
                      />

                      <div className="relative flex flex-col w-full">
                        <div className="relative flex items-center w-full h-[58px] rounded-xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-4 py-1.5 focus-within:border-brand-gold focus-within:ring-2 focus-within:ring-brand-gold/20 transition-all duration-300">
                          <FileText className="h-4.5 w-4.5 text-slate-500 mr-4 shrink-0" />
                          <div className="flex flex-col flex-1">
                            <span className="text-[9px] text-brand-gold font-bold uppercase tracking-wider">{lang === 'en' ? "License Expiry" : "Ranar Karewa"}</span>
                            <input
                              type="date"
                              required
                              value={licenseExpiry}
                              onChange={(e) => setLicenseExpiry(e.target.value)}
                              className="w-full bg-transparent text-white text-xs focus:outline-none placeholder-slate-700 font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative flex flex-col w-full">
                      <div className="relative flex items-center w-full min-h-[58px] rounded-xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-4 py-2 hover:border-slate-700 transition-all duration-300">
                        <User className="h-4.5 w-4.5 text-slate-500 mr-4 shrink-0" />
                        <div className="flex-1 flex flex-col">
                          <span className="text-[9px] text-brand-gold font-bold uppercase tracking-wider">{lang === 'en' ? "Passport Photo (Required)" : "Hoton Fasfo (Dole ne)"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => handleFileChange(e, setPassportPhoto)}
                            className="text-[10px] text-slate-400 file:mr-2 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:bg-slate-800 file:text-white cursor-pointer mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={nextStep} 
                        className="w-full font-black flex items-center justify-center gap-1.5 mt-2 cursor-pointer py-3.5 bg-brand-gold text-slate-950 hover:bg-brand-gold/90 transition-all rounded-xl text-xs uppercase tracking-widest"
                      >
                        {lang === 'en' ? "Continue to Guarantor" : "Tafi Zuwa Guarantor"}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </div>
                )}

                {/* STEP 2: Guarantor details */}
                {regStep === 2 && (
                  <div className="flex flex-col gap-4">
                    <FloatingInput
                      type="text"
                      label="Guarantor Full Name"
                      value={guarantorName}
                      onChange={(e) => setGuarantorName(e.target.value)}
                      icon={<User className="h-4.5 w-4.5" />}
                      placeholder="e.g. Alhaji Garba Haruna"
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="tel"
                        label="Guarantor Telephone"
                        value={guarantorPhone}
                        onChange={(e) => setGuarantorPhone(e.target.value)}
                        icon={<Phone className="h-4.5 w-4.5" />}
                        placeholder="e.g. +234..."
                        required
                      />

                      <FloatingInput
                        type="text"
                        label="Relationship Type"
                        value={guarantorRelationship}
                        onChange={(e) => setGuarantorRelationship(e.target.value)}
                        icon={<Users className="h-4.5 w-4.5" />}
                        placeholder="e.g. Uncle, Brother"
                        required
                      />
                    </div>

                    <FloatingInput
                      type="text"
                      label="Guarantor NIN"
                      value={guarantorNin}
                      onChange={(e) => setGuarantorNin(e.target.value.replace(/\D/g, ''))}
                      icon={<ShieldCheck className="h-4.5 w-4.5" />}
                      placeholder="11-digit NIN"
                      maxLength={11}
                      required
                    />

                    <FloatingInput
                      type="text"
                      label="Guarantor Full Address"
                      value={guarantorAddress}
                      onChange={(e) => setGuarantorAddress(e.target.value)}
                      icon={<Map className="h-4.5 w-4.5" />}
                      placeholder="e.g. 22 Airport Road, Kano"
                      required
                    />

                    <div className="relative flex flex-col w-full">
                      <div className="relative flex items-center w-full min-h-[58px] rounded-xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-4 py-2 hover:border-slate-700 transition-all duration-300">
                        <User className="h-4.5 w-4.5 text-slate-500 mr-4 shrink-0" />
                        <div className="flex-1 flex flex-col">
                          <span className="text-[9px] text-brand-gold font-bold uppercase tracking-wider">{lang === 'en' ? "Guarantor Passport (Required)" : "Hoton Fasfo na Mai Tsayawa"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => handleFileChange(e, setGuarantorPassport)}
                            className="text-[10px] text-slate-400 file:mr-2 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:bg-slate-800 file:text-white cursor-pointer mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-2">
                      <button 
                        type="button" 
                        onClick={prevStep}
                        className="flex-1 py-3 bg-slate-850 rounded-xl hover:bg-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer text-white border border-slate-800"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {lang === 'en' ? "Back" : "Koma"}
                      </button>
                      <button 
                        type="button"
                        onClick={nextStep} 
                        className="flex-1 py-3 bg-brand-gold hover:bg-brand-gold/90 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-widest"
                      >
                        {lang === 'en' ? "Continue" : "Gaba"}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Vehicle details */}
                {regStep === 3 && (
                  <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="text"
                        label="Brand / Make"
                        value={vehicleBrand}
                        onChange={(e) => setVehicleBrand(e.target.value)}
                        icon={<Car className="h-4.5 w-4.5" />}
                        placeholder="e.g. Mercedes-Benz"
                        required
                      />

                      <FloatingInput
                        type="text"
                        label="Vehicle Model"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        icon={<Car className="h-4.5 w-4.5" />}
                        placeholder="e.g. Actros 3340"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <FloatingInput
                          type="text"
                          label="Year"
                          value={vehicleYear}
                          onChange={(e) => setVehicleYear(e.target.value)}
                          icon={<FileText className="h-4.5 w-4.5" />}
                          placeholder="2022"
                          required
                        />
                      </div>

                      <div className="col-span-1">
                        <FloatingInput
                          type="text"
                          label="Colour"
                          value={vehicleColour}
                          onChange={(e) => setVehicleColour(e.target.value)}
                          icon={<FileText className="h-4.5 w-4.5" />}
                          placeholder="White"
                          required
                        />
                      </div>

                      <div className="col-span-1">
                        <div className="relative flex flex-col w-full">
                          <div className="relative flex items-center w-full h-[58px] rounded-xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-3 py-1.5 focus-within:border-brand-gold focus-within:ring-2 focus-within:ring-brand-gold/20 transition-all duration-300">
                            <Truck className="h-4 w-4 text-slate-500 mr-2 shrink-0" />
                            <div className="flex flex-col flex-1">
                              <span className="text-[9px] text-brand-gold font-bold uppercase tracking-wider">{lang === 'en' ? "Capacity" : "Iko"}</span>
                              <select
                                value={vehicleCapacity}
                                onChange={(e) => setVehicleCapacity(e.target.value)}
                                className="w-full bg-transparent text-white text-xs focus:outline-none placeholder-slate-700 font-medium border-0 p-0"
                              >
                                <option value="30 Tons">30 Tons</option>
                                <option value="40 Tons">40 Tons</option>
                                <option value="45 Tons">45 Tons</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="text"
                        label="Plate Number"
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                        icon={<Car className="h-4.5 w-4.5" />}
                        placeholder="e.g. KANO-432-KN"
                        required
                      />

                      <FloatingInput
                        type="text"
                        label="Reg Number"
                        value={vehicleRegNo}
                        onChange={(e) => setVehicleRegNo(e.target.value)}
                        icon={<FileText className="h-4.5 w-4.5" />}
                        placeholder="REG-MB-9921"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        type="text"
                        label="Chassis Number"
                        value={vehicleChassis}
                        onChange={(e) => setVehicleChassis(e.target.value)}
                        icon={<FileText className="h-4.5 w-4.5" />}
                        placeholder="WDB934032..."
                        required
                      />

                      <FloatingInput
                        type="text"
                        label="Engine Number"
                        value={vehicleEngine}
                        onChange={(e) => setVehicleEngine(e.target.value)}
                        icon={<FileText className="h-4.5 w-4.5" />}
                        placeholder="OM501LA..."
                        required
                      />
                    </div>

                    <div className="flex gap-4 mt-2">
                      <button 
                        type="button" 
                        onClick={prevStep}
                        className="flex-1 py-3 bg-slate-850 rounded-xl hover:bg-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer text-white border border-slate-800"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {lang === 'en' ? "Back" : "Koma"}
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-3 bg-brand-gold hover:bg-brand-gold/90 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-widest"
                      >
                        {lang === 'en' ? "Complete Register" : "Kammala Rijistar"}
                      </button>
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
                      <p className="text-xs text-slate-400 leading-relaxed mt-2 px-3 font-sans">
                        {lang === 'en' 
                          ? "Your corporate driver candidate file is queued. A security auditor is reviewing your NIN, license, and guarantor. We will contact you upon decision."
                          : "Takardun ku suna jiran tantancewa daga Admin. Za mu sanar da ku idan mun kammala."}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setActivePortal('login'); setRegStep(1); }}
                      className="font-bold border-slate-800 hover:bg-slate-800 mt-2 text-white cursor-pointer px-6 py-2.5 rounded-xl text-xs"
                    >
                      {lang === 'en' ? "Go to Login Portal" : "Koma shafin Shiga"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 text-[11px] text-center py-8 border-t border-slate-900 px-6 w-full mt-auto">
        <p>{dictionary.landing.footerText}</p>
      </footer>
    </div>
  );
};
