/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  ShieldCheck, 
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
  EyeOff,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  Clock,
  ArrowRight,
  TrendingUp,
  Globe
} from 'lucide-react';
import { Dictionary, Language, Theme } from '../types';
import { Button } from '../components/ui/Button';
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
        className={`relative flex items-center w-full h-[58px] rounded-xl border transition-all duration-300 bg-slate-950/40 backdrop-blur-md ${
          isFocused 
            ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,163,89,0.15)] bg-slate-900/60' 
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <div className={`absolute left-4 transition-colors duration-300 shrink-0 ${isFocused ? 'text-[#D4AF37]' : 'text-slate-400'}`}>
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
          className="w-full h-full pl-12 pr-12 pt-5 pb-1 text-[15px] bg-transparent border-0 text-white focus:outline-none focus:ring-0 placeholder:text-slate-600 font-medium"
        />

        <label
          className={`absolute left-12 pointer-events-none transition-all duration-300 ease-out font-semibold ${
            isFocused || hasValue
              ? 'top-2 text-[9px] text-[#D4AF37]/90 font-bold uppercase tracking-wider'
              : 'top-1/2 -translate-y-1/2 text-slate-400 text-[14px]'
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
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  onLanguageChange?: (lang: Language) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  dictionary,
  lang,
  onLoginAsDriver,
  onNavigateToRole,
  currentTheme = 'dark',
  onThemeChange,
  onLanguageChange
}) => {
  const [activePortal, setActivePortal] = useState<'login' | 'register'>('login');
  
  // Sticky header states
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertCenterOpen, setAlertCenterOpen] = useState(false);

  // Clock state (West African Time: UTC+1)
  const [timeStr, setTimeStr] = useState('');

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Multi-step Registration Wizard State
  const [regStep, setRegStep] = useState<1 | 2 | 3 | 4>(1); // 1: Personal, 2: Guarantor, 3: Vehicle, 4: Complete
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync WAT clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Calculate WAT (UTC + 1)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const watDate = new Date(utc + 3600000);
      
      const hours = watDate.getHours().toString().padStart(2, '0');
      const mins = watDate.getMinutes().toString().padStart(2, '0');
      const secs = watDate.getSeconds().toString().padStart(2, '0');
      
      setTimeStr(`${hours}:${mins}:${secs} WAT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
    setIsLoggingIn(true);
    
    if (!loginEmail || !loginPassword) {
      setLoginError(lang === 'en' ? "Please complete all validation parameters." : "Da fatan za a cika duka bayanan.");
      setIsLoggingIn(false);
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
        setIsLoggingIn(false);
        if (res.user.role === 'driver') {
          onLoginAsDriver(res.user.fullName);
        } else {
          onNavigateToRole(res.user.role);
        }
      }, 1000);
    } catch (err: any) {
      setIsLoggingIn(false);
      setLoginError(err.message || "Failed to authenticate.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess(false);
    setIsRegistering(true);

    // Validation
    if (!vehicleBrand || !vehicleModel || !vehiclePlate || !vehicleRegNo || !vehicleChassis || !vehicleEngine) {
      setRegError(lang === 'en' ? "All carrier vehicle specifications are mandatory." : "Duk bayanan motar sufuri suna da mahimmanci.");
      setIsRegistering(false);
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
      setIsRegistering(false);
      
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
      setIsRegistering(false);
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

  const scrollToPortal = (tab: 'login' | 'register') => {
    setActivePortal(tab);
    if (tab === 'register') {
      setRegStep(1);
    }
    setTimeout(() => {
      const element = document.getElementById('secure-access-portal');
      if (element) {
        const offset = 80; // Offset for sticky header
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = element.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-800' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 25, label: lang === 'en' ? 'Weak' : 'Mai rauni', color: 'bg-rose-500' };
    if (score === 2) return { score: 50, label: lang === 'en' ? 'Fair' : 'Matsakaici', color: 'bg-amber-500' };
    if (score === 3) return { score: 75, label: lang === 'en' ? 'Good' : 'Mai kyau', color: 'bg-emerald-500' };
    return { score: 100, label: lang === 'en' ? 'Strong' : 'Cikakke', color: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' };
  };

  const strength = getPasswordStrength(password);

  // Custom keyframes injected via style tag for performance-first animated mesh
  const animationStyles = `
    @keyframes float-orb-1 {
      0%, 100% { transform: translate(0px, 0px) scale(1); }
      50% { transform: translate(40px, -60px) scale(1.15); }
    }
    @keyframes float-orb-2 {
      0%, 100% { transform: translate(0px, 0px) scale(1.05); }
      50% { transform: translate(-50px, 40px) scale(0.9); }
    }
    @keyframes float-orb-3 {
      0%, 100% { transform: translate(0px, 0px) scale(0.95); }
      50% { transform: translate(30px, 50px) scale(1.1); }
    }
    .animate-float-1 {
      animation: float-orb-1 12s infinite ease-in-out;
    }
    .animate-float-2 {
      animation: float-orb-2 15s infinite ease-in-out;
    }
    .animate-float-3 {
      animation: float-orb-3 18s infinite ease-in-out;
    }
  `;

  return (
    <div className="w-full min-h-screen bg-[#071224] text-white flex flex-col font-sans relative overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-white">
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* AMBIENT GLOWING BACKDROP MESH */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Floating Glowing Orbs */}
        <div className="absolute top-[10%] left-[10%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-gradient-to-br from-[#D4AF37]/10 to-transparent blur-[80px] sm:blur-[120px] animate-float-1" />
        <div className="absolute top-[35%] right-[5%] w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full bg-gradient-to-br from-[#3B82F6]/8 to-transparent blur-[90px] sm:blur-[140px] animate-float-2" />
        <div className="absolute bottom-[15%] left-[20%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-gradient-to-br from-emerald-500/5 to-transparent blur-[70px] sm:blur-[110px] animate-float-3" />
        
        {/* Fine grid lines layout */}
        <div 
          className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:48px_48px]" 
          style={{ maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 80%)' }}
        />
      </div>

      {/* STICKY GLASSMOPRHISM NAVIGATION HEADER */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 border-b ${
        isScrolled 
          ? 'py-3 bg-[#071224]/85 backdrop-blur-md border-white/5 shadow-[0_10px_30px_rgba(2,6,23,0.3)]' 
          : 'py-5 bg-transparent border-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo Brand Group */}
          <div 
            className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all duration-200"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <CircularLogo size="sm" className="group-hover:rotate-12 transition-transform duration-300" />
            <div className="flex flex-col">
              <span className="font-extrabold text-[15px] sm:text-[17px] tracking-wider text-white font-mono leading-none">RUQAYYA</span>
              <span className="text-[9px] font-bold text-[#D4AF37] tracking-widest uppercase mt-0.5 leading-none">
                {lang === 'en' ? 'TRANSPORT ERP' : 'SUFURI ERP'}
              </span>
            </div>
          </div>

          {/* Controls: Desktop Links and Switchers */}
          <div className="hidden md:flex items-center gap-6">
            
            {/* Quick jump to portal link */}
            <button 
              onClick={() => scrollToPortal('login')}
              className="text-xs font-bold text-slate-300 hover:text-white hover:underline cursor-pointer transition-colors"
            >
              {lang === 'en' ? 'Driver Portal' : 'Sashen Direba'}
            </button>

            {/* Quick System Notifications alert bell */}
            <div className="relative">
              <button 
                onClick={() => setAlertCenterOpen(!alertCenterOpen)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-[#D4AF37] border border-white/5 hover:border-white/10 transition-all cursor-pointer relative"
                title={lang === 'en' ? "Security status" : "Tsaron na'ura"}
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </button>

              {/* Quick Alerts Dropdown */}
              <AnimatePresence>
                {alertCenterOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAlertCenterOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 bg-[#0B1736]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 z-20"
                    >
                      <h4 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2.5 flex items-center justify-between">
                        <span>{lang === 'en' ? 'Security Notice' : 'Tsaron Na\'ura'}</span>
                        <span className="text-[9px] bg-[#D4AF37]/10 text-[#D4AF37] px-1.5 py-0.5 rounded">Active</span>
                      </h4>
                      <div className="flex flex-col gap-2 text-[11px] text-slate-300 font-mono">
                        <div className="p-2 bg-slate-900/50 rounded border border-white/5">
                          <p className="text-emerald-400 font-bold">● SECURE PORTAL ACTIVE</p>
                          <p className="mt-0.5 text-slate-400">SSL and end-to-end database binding mapped.</p>
                        </div>
                        <div className="p-2 bg-slate-900/50 rounded border border-white/5">
                          <p className="text-[#D4AF37] font-bold">● PUBLIC GATEWAY v4.1</p>
                          <p className="mt-0.5 text-slate-400">Drivers dossier system synchronized with West African Haulage Registry.</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Language switch */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg p-0.5">
              <button 
                onClick={() => onLanguageChange && onLanguageChange('en')}
                className={`px-2 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  lang === 'en' 
                    ? 'bg-[#D4AF37] text-slate-950 font-black shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button 
                onClick={() => onLanguageChange && onLanguageChange('ha')}
                className={`px-2 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  lang === 'ha' 
                    ? 'bg-[#D4AF37] text-slate-950 font-black shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                HA
              </button>
            </div>

            {/* Dark mode switcher (triggers theme change for overall system) */}
            <button 
              onClick={() => onThemeChange && onThemeChange(currentTheme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-[#D4AF37] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
              title={lang === 'en' ? "Toggle core design" : "Sauya launi"}
            >
              {currentTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Portal login anchor button */}
            <button 
              onClick={() => scrollToPortal('login')}
              className="text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 rounded-lg hover:border-white/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>{lang === 'en' ? 'Direct Access' : 'Shiga kai tsaye'}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 md:hidden">
            <button 
              onClick={() => onLanguageChange && onLanguageChange(lang === 'en' ? 'ha' : 'en')}
              className="px-2 py-1 text-[10px] font-extrabold rounded-lg bg-white/5 border border-white/5 text-slate-300"
            >
              {lang === 'en' ? 'HA' : 'EN'}
            </button>
            
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-white/5 text-slate-300 border border-white/5"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

        </div>

        {/* Mobile menu panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full bg-[#071224] border-b border-white/5 md:hidden overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-3.5 text-sm font-semibold">
                
                <button 
                  onClick={() => { setMobileMenuOpen(false); scrollToPortal('login'); }}
                  className="w-full py-2.5 px-3 rounded-lg bg-white/5 border border-white/5 text-left text-slate-200 flex items-center justify-between"
                >
                  <span>{lang === 'en' ? 'Driver Login Portal' : 'Kofofin Shiga Direbobi'}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>

                <button 
                  onClick={() => { setMobileMenuOpen(false); scrollToPortal('register'); }}
                  className="w-full py-2.5 px-3 rounded-lg bg-white/5 border border-white/5 text-left text-slate-200 flex items-center justify-between"
                >
                  <span>{lang === 'en' ? 'Driver Registration' : 'Rijistar Sabbin Direbobi'}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>

                <div className="flex items-center justify-between py-2 border-t border-white/5 mt-1 px-1">
                  <span className="text-xs text-slate-400">{lang === 'en' ? "Visual Layout" : "Tsarin launi"}</span>
                  <button 
                    onClick={() => onThemeChange && onThemeChange(currentTheme === 'light' ? 'dark' : 'light')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-slate-200 border border-white/5"
                  >
                    {currentTheme === 'light' ? <><Moon className="h-3.5 w-3.5" /> <span>Dark</span></> : <><Sun className="h-3.5 w-3.5" /> <span>Light</span></>}
                  </button>
                </div>

                <div className="text-[10px] text-slate-500 font-mono text-center pt-2 border-t border-white/5">
                  RUQAYYA PUBLIC NODE Gateway - Active
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* COMPACT HERO SECTION */}
      <section className="relative z-10 w-full min-h-[500px] h-[65vh] sm:h-[70vh] flex items-center shrink-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center justify-center -mt-8">
          
          {/* Subtle top micro badge */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-6"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>{lang === 'en' ? 'Secure Gateway Hub' : 'Hanyar Sadarwa Ta Tsaro'}</span>
          </motion.div>

          {/* Primary elegant Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-premium-display tracking-tight text-white font-extrabold max-w-3xl leading-[1.1]"
          >
            {lang === 'en' ? 'Enterprise Fleet Operations,' : 'Gudanar Da Manyan Motocin Kamfani,'}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#f7cf57] to-[#D4AF37] mt-1">
              {lang === 'en' ? 'Powered by Intelligence.' : 'Gami Da Kyawun Fasaha.'}
            </span>
          </motion.h1>

          {/* Concise and highly professional secondary single subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-slate-300 text-sm sm:text-base md:text-lg max-w-2xl mt-5 font-medium leading-relaxed"
          >
            {lang === 'en' 
              ? 'The secure, real-time logistics entry point and operations dashboard for West Africa\'s elite transport fleet.'
              : 'Garin shiga na musamman don tsaro, jigilar kaya, da takardun manyan motoci don yammacin Afirka.'}
          </motion.p>

          {/* Magnetic-like CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto"
          >
            <button 
              onClick={() => scrollToPortal('login')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#f7cf57] text-slate-950 font-extrabold text-sm sm:text-base tracking-wide shadow-lg shadow-[#D4AF37]/15 hover:shadow-[#D4AF37]/30 hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="h-4 w-4" />
              <span>{lang === 'en' ? 'Access Driver Portal' : 'Shiga Sashen Direba'}</span>
            </button>

            <button 
              onClick={() => scrollToPortal('register')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm sm:text-base tracking-wide border border-white/10 hover:border-white/25 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4 text-[#D4AF37]" />
              <span>{lang === 'en' ? 'Register New Driver' : 'Sake Rijistar Direba'}</span>
            </button>
          </motion.div>

        </div>
      </section>

      {/* SECURE ACCESS PORTAL CARD - POSITIONED IMMEDIATELY BELOW HERO */}
      <section id="secure-access-portal" className="relative z-20 w-full px-4 sm:px-6 lg:px-8 pb-12 shrink-0">
        <div className="max-w-2xl mx-auto">
          
          <div className="bg-[#0b1736]/50 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(2,6,23,0.8)] overflow-hidden transition-all duration-300 hover:border-white/15">
            
            {/* Sliding segment controller switch */}
            <div className="flex border-b border-white/10 bg-slate-950/20 p-2 gap-2">
              <button
                onClick={() => setActivePortal('login')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
                  activePortal === 'login' 
                    ? 'text-slate-950 bg-gradient-to-r from-[#D4AF37] to-[#f59e0b] shadow-md font-black' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Lock className="h-4 w-4" />
                <span>{lang === 'en' ? 'DRIVER PORTAL LOGIN' : 'SHIGA SASHA'}</span>
              </button>

              <button
                onClick={() => { setActivePortal('register'); setRegStep(1); }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
                  activePortal === 'register' 
                    ? 'text-slate-950 bg-gradient-to-r from-[#D4AF37] to-[#f59e0b] shadow-md font-black' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>{lang === 'en' ? 'DRIVER REGISTRATION' : 'RIJISTAR DIREBA'}</span>
              </button>
            </div>

            {/* Inner Content Area */}
            <div className="p-6 sm:p-8">
              
              {/* PORTAL LOGIN PANEL */}
              {activePortal === 'login' && (
                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
                  <div className="text-center mb-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {lang === 'en' ? 'Authenticate Secure Credentials' : 'Tabbatar Da Bayanai Masu Aminci'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {dictionary.landing.portalNotice}
                    </p>
                  </div>

                  {loginError && (
                    <Alert type="danger" title={lang === 'en' ? "Access Denied" : "An ki amincewa"}>
                      {loginError}
                    </Alert>
                  )}

                  {loginSuccess && (
                    <Alert type="success" title={lang === 'en' ? "Access Approved" : "An amince"}>
                      {lang === 'en' ? "Session initiated. Synchronizing database entries..." : "An kaddamar da shiga. Ana hada bayanai..."}
                    </Alert>
                  )}

                  {/* Input email */}
                  <FloatingInput 
                    type="email"
                    label={lang === 'en' ? "Corporate Email Address" : "Adireshin Imel Na Kamfani"}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    icon={<Mail className="h-5 w-5" />}
                    required
                  />

                  {/* Input password */}
                  <FloatingInput 
                    type={showPassword ? 'text' : 'password'}
                    label={lang === 'en' ? "Security Password" : "Kalmar Sirri Ta Tsaro"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    icon={<Lock className="h-5 w-5" />}
                    required
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-white p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />

                  {/* Remember me & Quick Admin links */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1 text-xs">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-white/15 bg-slate-950/40 text-[#D4AF37] focus:ring-offset-0 focus:ring-0 h-4 w-4"
                      />
                      <span>{lang === 'en' ? 'Remember session token' : 'Kiyaye bayanan shiga'}</span>
                    </label>

                    <div className="flex items-center gap-2.5 text-slate-400">
                      <span>{lang === 'en' ? 'Demo entry:' : 'Hanyoyin gwaji:'}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          setLoginEmail('operator@ruqayya.com');
                          setLoginPassword('operator123');
                        }}
                        className="text-[#D4AF37] hover:underline font-bold"
                      >
                        Admin
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={async () => {
                          setLoginEmail('director@ruqayya.com');
                          setLoginPassword('director123');
                        }}
                        className="text-[#D4AF37] hover:underline font-bold"
                      >
                        Director
                      </button>
                    </div>
                  </div>

                  {/* Submit Login */}
                  <Button 
                    type="submit" 
                    variant="secondary"
                    isLoading={isLoggingIn}
                    className="w-full h-12 rounded-xl text-slate-950 font-black text-sm uppercase tracking-wider bg-gradient-to-r from-[#D4AF37] to-[#f59e0b] shadow-lg mt-3"
                  >
                    {lang === 'en' ? 'Acknowledge & Access Portal' : 'Tabbatar Da Shiga Sashe'}
                  </Button>
                </form>
              )}

              {/* PORTAL MULTI-STEP REGISTRATION WIZARD */}
              {activePortal === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5">
                  
                  {/* Progress Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-4 mb-2">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                        {regStep === 1 && (lang === 'en' ? '1. Personal Information' : '1. Bayanin Direba')}
                        {regStep === 2 && (lang === 'en' ? '2. Guarantor Guarantee' : '2. Bayanin Tsayawa')}
                        {regStep === 3 && (lang === 'en' ? '3. Carrier Specifications' : '3. Bayanin Motar')}
                        {regStep === 4 && (lang === 'en' ? 'Registration Underway' : 'Ana Cikin Gudanarwa')}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {regStep <= 3 ? (lang === 'en' ? `Step ${regStep} of 3 to finalize application` : `Mataki na ${regStep} cikin 3 na kammalawa`) : (lang === 'en' ? 'Reviewing dossier' : 'Duban takardun aiki')}
                      </p>
                    </div>

                    {/* Minimalist stepper indicator dots */}
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3].map((step) => (
                        <div 
                          key={step} 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            regStep === step 
                              ? 'w-6 bg-[#D4AF37]' 
                              : regStep > step 
                              ? 'w-2 bg-emerald-500' 
                              : 'w-2 bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {regError && (
                    <Alert type="danger" title={lang === 'en' ? "Validation Error" : "Kuskuren Tabbatarwa"}>
                      {regError}
                    </Alert>
                  )}

                  {/* STEP 1: PERSONAL INFORMATION */}
                  {regStep === 1 && (
                    <div className="flex flex-col gap-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Full Legal Name' : 'Cikakken Suna'}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          icon={<User className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="tel"
                          label={lang === 'en' ? 'Active Telephone' : 'Lambar Waya'}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          icon={<Phone className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <FloatingInput 
                        type="email"
                        label={lang === 'en' ? 'Email Address' : 'Adireshin Imel'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<Mail className="h-4 w-4" />}
                        required
                      />

                      <FloatingInput 
                        type="text"
                        label={lang === 'en' ? 'Residential Address' : 'Gidanka na yanzu'}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        icon={<FileText className="h-4 w-4" />}
                        required
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'National NIN (11 Digits)' : 'Lambar Dan Kasa NIN'}
                          value={nin}
                          onChange={(e) => setNin(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                          maxLength={11}
                        />

                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Driver License No.' : 'Lambar Lasisin Tuki'}
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="date"
                          label={lang === 'en' ? 'License Expiry' : 'Ranar Karewa'}
                          value={licenseExpiry}
                          onChange={(e) => setLicenseExpiry(e.target.value)}
                          icon={<Clock className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="password"
                          label={lang === 'en' ? 'Create Password' : 'Sake Kalmar Sirri'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          icon={<Lock className="h-4 w-4" />}
                          required
                        />
                      </div>

                      {/* Password strength micro bars */}
                      {password && (
                        <div className="px-1 flex flex-col gap-1.5 -mt-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <span>Password Strength:</span>
                            <span className={strength.score >= 75 ? 'text-emerald-400' : strength.score >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                              {strength.label}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex">
                            <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.score}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Passport upload drag & drop area */}
                      <div className="border border-dashed border-white/10 hover:border-[#D4AF37]/30 rounded-xl p-4 bg-slate-950/20 text-center transition-all">
                        <span className="block text-xs font-bold text-slate-300 mb-2">
                          {lang === 'en' ? 'Driver Passport Photo (Max 5MB)' : 'Hoton Fasfo na Direba (Iyaka 5MB)'}
                        </span>
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, setPassportPhoto)}
                          className="hidden"
                          id="passport-upload"
                          required
                        />
                        <label 
                          htmlFor="passport-upload"
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#D4AF37]" />
                          <span>{passportPhoto ? (lang === 'en' ? '✓ File Staged' : '✓ An ajiye hoton') : (lang === 'en' ? 'Select Image' : 'Zabi hoto')}</span>
                        </label>
                        {passportPhoto && (
                          <div className="mt-3 flex items-center justify-center">
                            <img src={passportPhoto} className="h-12 w-12 rounded-lg border border-white/20 object-cover" alt="staged passport" />
                          </div>
                        )}
                      </div>

                      {/* Button next */}
                      <button 
                        type="button" 
                        onClick={nextStep}
                        className="w-full h-11 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all mt-2 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <span>{lang === 'en' ? 'Verify and Proceed' : 'Tura Kuma Tafi Gaba'}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* STEP 2: GUARANTOR GUARANTEE */}
                  {regStep === 2 && (
                    <div className="flex flex-col gap-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? "Guarantor's Full Name" : 'Suna Mai Tsaya Maka'}
                          value={guarantorName}
                          onChange={(e) => setGuarantorName(e.target.value)}
                          icon={<User className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="tel"
                          label={lang === 'en' ? "Guarantor Telephone" : 'Lambar Wayarsa'}
                          value={guarantorPhone}
                          onChange={(e) => setGuarantorPhone(e.target.value)}
                          icon={<Phone className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <FloatingInput 
                        type="text"
                        label={lang === 'en' ? "Guarantor Home Address" : 'Gidan Mai Tsaya Maka'}
                        value={guarantorAddress}
                        onChange={(e) => setGuarantorAddress(e.target.value)}
                        icon={<FileText className="h-4 w-4" />}
                        required
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? "Relationship to Driver" : 'Dangantaka'}
                          value={guarantorRelationship}
                          onChange={(e) => setGuarantorRelationship(e.target.value)}
                          icon={<Users className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? "Guarantor NIN" : 'Lambar NIN ta Mai Tsayawa'}
                          value={guarantorNin}
                          onChange={(e) => setGuarantorNin(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                          maxLength={11}
                        />
                      </div>

                      {/* Passport upload guarantor */}
                      <div className="border border-dashed border-white/10 hover:border-[#D4AF37]/30 rounded-xl p-4 bg-slate-950/20 text-center transition-all">
                        <span className="block text-xs font-bold text-slate-300 mb-2">
                          {lang === 'en' ? 'Guarantor Passport Photo (Max 5MB)' : 'Hoton Fasfo na Mai Tsaya Maka (Iyaka 5MB)'}
                        </span>
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, setGuarantorPassport)}
                          className="hidden"
                          id="guarantor-upload"
                          required
                        />
                        <label 
                          htmlFor="guarantor-upload"
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200 text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-[#D4AF37]" />
                          <span>{guarantorPassport ? (lang === 'en' ? '✓ File Staged' : '✓ An ajiye hoton') : (lang === 'en' ? 'Select Image' : 'Zabi hoto')}</span>
                        </label>
                        {guarantorPassport && (
                          <div className="mt-3 flex items-center justify-center">
                            <img src={guarantorPassport} className="h-12 w-12 rounded-lg border border-white/20 object-cover" alt="staged passport" />
                          </div>
                        )}
                      </div>

                      {/* Navigation buttons */}
                      <div className="flex gap-3 mt-2">
                        <button 
                          type="button" 
                          onClick={prevStep}
                          className="flex-1 h-11 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>{lang === 'en' ? 'Back' : 'Baya'}</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={nextStep}
                          className="flex-1 h-11 bg-[#D4AF37] text-slate-950 hover:bg-[#f59e0b] rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>{lang === 'en' ? 'Verify and Continue' : 'Tafi Gaba'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  )}

                  {/* STEP 3: VEHICLE SPECIFICATIONS */}
                  {regStep === 3 && (
                    <div className="flex flex-col gap-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Vehicle Brand' : 'Kamfanin kera Mota'}
                          value={vehicleBrand}
                          onChange={(e) => setVehicleBrand(e.target.value)}
                          icon={<Car className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Vehicle Model' : 'Irin Mota'}
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          icon={<Car className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Year of Manufacture' : 'Shekarar kera ta'}
                          value={vehicleYear}
                          onChange={(e) => setVehicleYear(e.target.value)}
                          icon={<Clock className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Vehicle Colour' : 'Launin Mota'}
                          value={vehicleColour}
                          onChange={(e) => setVehicleColour(e.target.value)}
                          icon={<Car className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Plate Number' : 'Lambar Mota (Plate Number)'}
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Registration Number' : 'Lambar Rajista'}
                          value={vehicleRegNo}
                          onChange={(e) => setVehicleRegNo(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Chassis Number' : 'Lambar Sifa (Chassis Number)'}
                          value={vehicleChassis}
                          onChange={(e) => setVehicleChassis(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                        />

                        <FloatingInput 
                          type="text"
                          label={lang === 'en' ? 'Engine Number' : 'Lambar Inji'}
                          value={vehicleEngine}
                          onChange={(e) => setVehicleEngine(e.target.value)}
                          icon={<FileText className="h-4 w-4" />}
                          required
                        />
                      </div>

                      <FloatingInput 
                        type="text"
                        label={lang === 'en' ? 'Tonnage Tonnage (e.g. 30 Tons)' : 'Karfinta nauyi (Tons)'}
                        value={vehicleCapacity}
                        onChange={(e) => setVehicleCapacity(e.target.value)}
                        icon={<Truck className="h-4 w-4" />}
                        required
                      />

                      {/* Navigation buttons */}
                      <div className="flex gap-3 mt-2">
                        <button 
                          type="button" 
                          onClick={prevStep}
                          className="flex-1 h-11 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>{lang === 'en' ? 'Back' : 'Baya'}</span>
                        </button>
                        <Button 
                          type="submit" 
                          variant="secondary"
                          isLoading={isRegistering}
                          className="flex-1 h-11 bg-gradient-to-r from-[#D4AF37] to-[#f59e0b] text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1"
                        >
                          <span>{lang === 'en' ? 'Commit Dossier' : 'Tura Kayan Rijista'}</span>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>

                    </div>
                  )}

                  {/* STEP 4: SUBMISSION COMPLETE SCREEN */}
                  {regStep === 4 && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center py-6 flex flex-col items-center justify-center gap-4"
                    >
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle className="h-8 w-8" />
                      </div>

                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                          {lang === 'en' ? 'Registration Successfully Received' : 'An Karbi Rijista Cikin Nasara'}
                        </h3>
                        <p className="text-xs text-slate-300 max-w-md mx-auto mt-2 leading-relaxed">
                          {lang === 'en' 
                            ? 'Your driver profile, guarantor guarantees, and vehicle specifications have been mapped. Operations administrative review takes approximately 12-24 hours.'
                            : 'An adana bayananka na direba, masu tsaya maka, da na motarka. Gudanarwa na kamfani zai duba bayananka cikin sa\'o\'i 12-24.'}
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/5 text-left text-xs font-mono max-w-sm w-full">
                        <p className="text-[#D4AF37] font-bold uppercase tracking-wider text-[10px] mb-1">Dossier Logged Parameters</p>
                        <p className="text-slate-400">STATUS: <span className="text-amber-400 font-bold">AWAITING REVIEW</span></p>
                        <p className="text-slate-400">ENCRYPTION: SECURE RSA BIND</p>
                        <p className="text-slate-400">TIMESTAMP: {timeStr}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setActivePortal('login'); setRegStep(1); }}
                        className="mt-2 text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1"
                      >
                        <span>{lang === 'en' ? 'Return to Portal Login' : 'Koma don shiga sashe'}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </motion.div>
                  )}

                </form>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* COMPACT BENTO SHOWCASE SECTION (WHY CHOOSE US) - EXACTLY 3 HIGH-END CARDS */}
      <section className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-10 shrink-0 border-t border-white/5 bg-slate-950/20">
        <div className="max-w-5xl mx-auto">
          
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              {lang === 'en' ? 'Engineered for West African Logistics' : 'An Kera Don Sufuri Na Yammacin Afirka'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl mx-auto leading-relaxed">
              {lang === 'en' 
                ? 'Absolute security, complete financial audit loops, and real-time synchronization for fleet leaders.'
                : 'Cikakken tsaro da gaskiya ga masu gudanarwa da masu hannun jari.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CARD 1: SECURE OPERATIONS */}
            <div className="group bg-[#0b1736]/40 backdrop-blur-md border border-white/10 hover:border-[#D4AF37]/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 flex flex-col gap-4 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20">
                <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#D4AF37] transition-colors">
                  {lang === 'en' ? 'Secure Operations' : 'Tabbataccen Tsaro'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {lang === 'en' 
                    ? 'Rigorous multi-role session logins, real-time driver profile staging, and tamper-proof cryptographic audit tracking.'
                    : 'Shiga tsari mai aminci, adana rukunin direbobi, da rikodin duk ayyuka ba tare da kuskure ba.'}
                </p>
              </div>
            </div>

            {/* CARD 2: TRANSPARENT PAYMENTS */}
            <div className="group bg-[#0b1736]/40 backdrop-blur-md border border-white/10 hover:border-[#D4AF37]/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 flex flex-col gap-4 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20">
                <TrendingUp className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#D4AF37] transition-colors">
                  {lang === 'en' ? 'Transparent Payments' : 'Biyan Kudade Na Gaskiya'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {lang === 'en' 
                    ? 'Meticulous micro-payment triggers, secure digital fuel voucher logs, and streamlined fleet revenue tracking.'
                    : 'Gudanar da raba rasit din mai na bogi, lissafin manyan motoci, da kudaden shiga na gaskiya.'}
                </p>
              </div>
            </div>

            {/* CARD 3: DRIVER MANAGEMENT */}
            <div className="group bg-[#0b1736]/40 backdrop-blur-md border border-white/10 hover:border-[#D4AF37]/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 flex flex-col gap-4 shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20">
                <Truck className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#D4AF37] transition-colors">
                  {lang === 'en' ? 'Driver Management' : 'Gudanar Da Direbobi'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {lang === 'en' 
                    ? 'Comprehensive electronic driver portfolios, direct vehicle registrations, and secure document vaults.'
                    : 'Dandalin kula da takaddun direbobi, mika motoci ga direba, da tsaron duka takardu.'}
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ULTRA-COMPACT MINIMALIST FOOTER */}
      <footer className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-8 border-t border-white/5 bg-[#071224] mt-auto shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-xs text-slate-500">
          
          {/* Logo brand */}
          <div className="flex items-center gap-2">
            <CircularLogo size="sm" />
            <div className="flex flex-col text-left">
              <span className="font-bold text-white font-mono leading-none tracking-wider text-xs">RUQAYYA TRANSPORT</span>
              <span className="text-[8px] text-slate-500 tracking-widest uppercase mt-0.5 font-bold">LOGISTICS LIMITED</span>
            </div>
          </div>

          {/* Jump Links & Contacts */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-slate-400 font-medium">
            <button 
              onClick={() => scrollToPortal('login')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {lang === 'en' ? 'Driver Portal' : 'Shiga kofa'}
            </button>
            <span>•</span>
            <a 
              href="mailto:operations@ruqayyatransport.com" 
              className="hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <Mail className="h-3 w-3 text-[#D4AF37]" />
              <span>operations@ruqayyatransport.com</span>
            </a>
          </div>

          {/* Copyright & WAT Clock */}
          <div className="flex flex-col items-center sm:items-end gap-1 font-mono text-[10px]">
            <span>{timeStr}</span>
            <span>{lang === 'en' ? '© 2026 RUQAYYA TRANSPORT. All rights reserved.' : '© 2026 RUQAYYA SUFURI. An kiyaye haƙƙoƙi.'}</span>
          </div>

        </div>
      </footer>

    </div>
  );
};
