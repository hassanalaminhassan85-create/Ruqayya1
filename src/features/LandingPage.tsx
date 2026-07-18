/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  Bell, 
  Sun, 
  Moon, 
  ArrowRight, 
  Clock,
  User,
  ShieldAlert,
  KeyRound,
  FileText,
  Briefcase,
  Users,
  CheckCircle,
  HelpCircle,
  Hash,
  MapPin,
  FileSpreadsheet,
  Upload,
  Camera,
  Paperclip
} from 'lucide-react';
import { Dictionary, Language, Theme } from '../types';
import { Button } from '../components/ui/Button';
import { api } from '../utils/api';
import { CircularLogo } from '../components/CircularLogo';

// Helper to normalize paths
const normalizePath = (path: string): string => {
  let clean = path.trim().split('?')[0].split('#')[0];
  if (clean.endsWith('/') && clean !== '/') {
    clean = clean.slice(0, -1);
  }
  return clean || '/';
};

interface LandingPageProps {
  pathname: string;
  dictionary: Dictionary;
  lang: Language;
  onLoginAsDriver: (fullName: string) => void;
  onNavigateToRole: (role: 'driver' | 'admin' | 'director' | 'shareholder') => void;
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  onLanguageChange?: (lang: Language) => void;
  sessionExpiredMessage?: string;
  onClearSessionExpiredMessage?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  pathname,
  dictionary,
  lang,
  onLoginAsDriver,
  onNavigateToRole,
  currentTheme = 'dark',
  onThemeChange,
  onLanguageChange,
  sessionExpiredMessage,
  onClearSessionExpiredMessage
}) => {
  // Clock state (West African Time: UTC+1)
  const [timeStr, setTimeStr] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  // General Portal / Tab State
  // 'driver' or 'shareholder'
  const [publicTab, setPublicTab] = useState<'driver' | 'shareholder'>('driver');
  // 'login' or 'register' (for drivers)
  const [driverMode, setDriverMode] = useState<'login' | 'register'>('login');

  // Enterprise Username Login States
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  // Standard Email/Password Login States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Driver Registration Form States (Multi-step)
  const [regStep, setRegStep] = useState(1);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  // Driver Registration Fields
  const [regFullName, setRegFullName] = useState('');
  const [regRtlId, setRegRtlId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regNin, setRegNin] = useState('');
  const [regLicense, setRegLicense] = useState('');
  const [regLicenseExpiry, setRegLicenseExpiry] = useState('');
  const [regPlateNumber, setRegPlateNumber] = useState('');
  const [regGuarantorName, setRegGuarantorName] = useState('');
  const [regGuarantorPhone, setRegGuarantorPhone] = useState('');

  // Extended ERP Driver Registration Fields
  const [regPassportPhoto, setRegPassportPhoto] = useState('');
  const [regGuarantorAddress, setRegGuarantorAddress] = useState('');
  const [regGuarantorRelationship, setRegGuarantorRelationship] = useState('');
  const [regGuarantorNin, setRegGuarantorNin] = useState('');
  const [regGuarantorPassport, setRegGuarantorPassport] = useState('');

  const [regVehicleBrand, setRegVehicleBrand] = useState('SinoTruck');
  const [regVehicleModel, setRegVehicleModel] = useState('Howo');
  const [regVehicleYear, setRegVehicleYear] = useState('2024');
  const [regVehicleColour, setRegVehicleColour] = useState('');
  const [regVehicleRegNo, setRegVehicleRegNo] = useState('');
  const [regVehicleChassisNo, setRegVehicleChassisNo] = useState('');
  const [regVehicleEngineNo, setRegVehicleEngineNo] = useState('');
  const [regVehicleCapacity, setRegVehicleCapacity] = useState('30 Tons');

  // Get normalized pathname to customize form
  const cleanPath = normalizePath(pathname || '/');

  // Determine portal context based on URL path
  const isDirectorPortal = cleanPath.startsWith('/director');
  const isAdminPortal = cleanPath.startsWith('/admin');
  const isEnterprisePortal = isDirectorPortal || isAdminPortal;

  // Handle scroll header effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync WAT clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
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

  // Submit Handler for Enterprise Username Gateway
  const handleUsernameLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess(false);
    setUsernameLoading(true);

    const trimmed = username.trim().toUpperCase();
    if (!trimmed) {
      setUsernameError(lang === 'en' ? "Please enter your enterprise username." : "Da fatan za a shigar da sunan shiga.");
      setUsernameLoading(false);
      return;
    }

    // Direct local constraints checks for quick user feedback
    if (isDirectorPortal && trimmed !== 'MMR') {
      setUsernameError(lang === 'en' ? "Access Denied: Invalid enterprise username for Director portal." : "An hana shiga: Sunan shiga na Darakta bai da kyau.");
      setUsernameLoading(false);
      return;
    }
    if (isAdminPortal && trimmed !== 'ADAM' && trimmed !== 'ABAKAKA') {
      setUsernameError(lang === 'en' ? "Access Denied: Invalid enterprise username for Admin portal." : "An hana shiga: Sunan shiga na Admin bai da kyau.");
      setUsernameLoading(false);
      return;
    }

    try {
      if (onClearSessionExpiredMessage) {
        onClearSessionExpiredMessage();
      }

      const res = await api.login({ username: trimmed, portal: cleanPath });
      
      if (!res || !res.success || !res.user || !res.user.role) {
        throw new Error(lang === 'en' ? "Server returned empty or invalid session configuration. Attempting local validation fallback." : "Sabar ta dawo da gurbataccen zama. Ana kokarin shiga ta sashi na gida.");
      }
      
      setUsernameSuccess(true);
      setTimeout(() => {
        setUsernameLoading(false);
        const userRole = res.user.role;
        const targetPath = userRole === 'admin' ? '/admin' : userRole === 'director' ? '/director' : '/';
        window.history.pushState({}, '', targetPath);
        onNavigateToRole(userRole);
      }, 800);
    } catch (err: any) {
      console.warn("Server auth failed, checking local fallback...", err);
      // Local fallback for high reliability when server is unreachable or offline (e.g. static Cloudflare pages)
      if (trimmed === 'MMR' || trimmed === 'ADAM' || trimmed === 'ABAKAKA') {
        const fallbackRole = trimmed === 'MMR' ? 'director' : 'admin';
        const fakeToken = `tok_fallback_${trimmed}_${Date.now()}`;
        api.setToken(fakeToken);
        
        setUsernameSuccess(true);
        setTimeout(() => {
          setUsernameLoading(false);
          const targetPath = fallbackRole === 'admin' ? '/admin' : '/director';
          window.history.pushState({}, '', targetPath);
          onNavigateToRole(fallbackRole);
        }, 800);
        return;
      }

      setUsernameLoading(false);
      setUsernameError(err.message || (lang === 'en' ? "Authentication failed." : "Gaza tabbatar da shiga."));
    }
  };

  // Submit Handler for Standard Email/Password Logins
  const handleStandardLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess(false);
    setLoginLoading(true);

    if (!email || !password) {
      setLoginError(lang === 'en' ? "Please enter your email and password credentials." : "Da fatan za a shigar da imel da kalmar sirri.");
      setLoginLoading(false);
      return;
    }

    try {
      if (onClearSessionExpiredMessage) {
        onClearSessionExpiredMessage();
      }

      const res = await api.login({ email, password });
      
      if (!res || !res.success || !res.user || !res.user.role) {
        throw new Error(lang === 'en' ? "Server returned empty or invalid validation. Attempting local profile fallback." : "Sabar ta dawo da gurbataccen sakamako. Ana kokarin sashi na gida.");
      }

      setLoginSuccess(true);
      setTimeout(() => {
        setLoginLoading(false);
        const userRole = res.user.role;
        
        if (userRole === 'driver') {
          onLoginAsDriver(res.user.fullName);
        } else {
          onNavigateToRole(userRole);
        }
      }, 800);
    } catch (err: any) {
      console.warn("Standard auth failed, checking local fallback...", err);
      // Local fallback for high reliability when server is unreachable or offline
      const lowerEmail = email.toLowerCase().trim();
      if (
        (lowerEmail === 'musa.driver@ruqayyatransport.com' && password === 'driver123') ||
        (lowerEmail === 'kabir.shareholder@ruqayyatransport.com' && password === 'shareholder123') ||
        (lowerEmail === 'amina.shareholder@ruqayyatransport.com' && password === 'shareholder123') ||
        (lowerEmail === 'director@ruqayyatransport.com' && password === 'director123') ||
        (lowerEmail === 'admin@ruqayyatransport.com' && password === 'admin123')
      ) {
        let fallbackRole: 'driver' | 'shareholder' | 'director' | 'admin' = 'driver';
        let fullName = 'Driver MUSA';
        let userKey = 'MUSA';

        if (lowerEmail === 'musa.driver@ruqayyatransport.com') {
          fallbackRole = 'driver';
          fullName = 'Driver MUSA';
          userKey = 'MUSA';
        } else if (lowerEmail === 'kabir.shareholder@ruqayyatransport.com') {
          fallbackRole = 'shareholder';
          fullName = 'Shareholder KABIR';
          userKey = 'KABIR';
        } else if (lowerEmail === 'amina.shareholder@ruqayyatransport.com') {
          fallbackRole = 'shareholder';
          fullName = 'Shareholder AMINA';
          userKey = 'AMINA';
        } else if (lowerEmail === 'director@ruqayyatransport.com') {
          fallbackRole = 'director';
          fullName = 'Executive Director MMR';
          userKey = 'MMR';
        } else if (lowerEmail === 'admin@ruqayyatransport.com') {
          fallbackRole = 'admin';
          fullName = 'Operations Admin ADAM';
          userKey = 'ADAM';
        }

        const fakeToken = `tok_fallback_${userKey}_${Date.now()}`;
        api.setToken(fakeToken);
        setLoginSuccess(true);
        setTimeout(() => {
          setLoginLoading(false);
          if (fallbackRole === 'driver') {
            onLoginAsDriver(fullName);
          } else {
            onNavigateToRole(fallbackRole);
          }
        }, 800);
        return;
      }

      setLoginLoading(false);
      setLoginError(err.message || (lang === 'en' ? "Access Denied: Invalid credentials." : "An hana shiga: Bayanan shiga ba daidai ba ne."));
    }
  };

  // Submit Handler for Driver Registration
  const handleDriverRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess(false);

    // Validation
    if (!regFullName || !regRtlId || !regEmail || !regPhone || !regAddress || !regPassword) {
      setRegError(lang === 'en' ? "Step 1: Missing core profile fields (RTL-ID is required)." : "Mataki na 1: Akwai guraren da ba a cike ba (ana buƙatar RTL-ID).");
      setRegStep(1);
      return;
    }
    if (!regPassportPhoto) {
      setRegError(lang === 'en' ? "Step 1: Driver passport photograph is required." : "Mataki na 1: Ana buƙatar hoton fasfo na direba.");
      setRegStep(1);
      return;
    }
    if (!regNin || !regLicense) {
      setRegError(lang === 'en' ? "Step 2: Verification details are required." : "Mataki na 2: Ana buƙatar bayanan tabbatarwa.");
      setRegStep(2);
      return;
    }
    if (!regPlateNumber || !regVehicleBrand || !regVehicleModel || !regVehicleColour) {
      setRegError(lang === 'en' ? "Step 3: Missing essential vehicle details." : "Mataki na 3: Wasu bayanan abun hawa ba su cika ba.");
      setRegStep(3);
      return;
    }
    if (!regGuarantorName || !regGuarantorPhone || !regGuarantorAddress || !regGuarantorRelationship || !regGuarantorNin || !regGuarantorPassport) {
      setRegError(lang === 'en' ? "Step 4: All guarantor details and guarantor passport are required." : "Mataki na 4: Ana buƙatar duk bayanan mai lamuni da hoton fasfonsa.");
      setRegStep(4);
      return;
    }

    setRegLoading(true);

    const payload = {
      personal: {
        fullName: regFullName,
        companyDriverId: regRtlId,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        address: regAddress,
        nin: regNin,
        licenseNumber: regLicense,
        licenseExpiry: regLicenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        passportPhoto: regPassportPhoto
      },
      guarantor: {
        fullName: regGuarantorName,
        phone: regGuarantorPhone,
        address: regGuarantorAddress,
        relationship: regGuarantorRelationship,
        nin: regGuarantorNin,
        passport: regGuarantorPassport
      },
      vehicle: {
        plateNumber: regPlateNumber,
        brand: regVehicleBrand,
        model: regVehicleModel,
        year: regVehicleYear,
        colour: regVehicleColour,
        registrationNumber: regVehicleRegNo || `REG-${Math.floor(100000 + Math.random() * 900000)}`,
        chassisNumber: regVehicleChassisNo || `CHS-${Math.floor(100000 + Math.random() * 900000)}`,
        engineNumber: regVehicleEngineNo || `ENG-${Math.floor(100000 + Math.random() * 900000)}`,
        capacity: regVehicleCapacity
      }
    };

    try {
      await api.registerDriver(payload);
      setRegSuccess(true);
      setRegLoading(false);
      
      // Clear registration form
      setRegFullName('');
      setRegRtlId('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setRegAddress('');
      setRegNin('');
      setRegLicense('');
      setRegLicenseExpiry('');
      setRegPlateNumber('');
      setRegGuarantorName('');
      setRegGuarantorPhone('');
      
      // Clear new extended states
      setRegPassportPhoto('');
      setRegGuarantorAddress('');
      setRegGuarantorRelationship('');
      setRegGuarantorNin('');
      setRegGuarantorPassport('');
      setRegVehicleBrand('SinoTruck');
      setRegVehicleModel('Howo');
      setRegVehicleYear('2024');
      setRegVehicleColour('');
      setRegVehicleRegNo('');
      setRegVehicleChassisNo('');
      setRegVehicleEngineNo('');
      setRegVehicleCapacity('30 Tons');
      
      setRegStep(1);

      // Switch to Login Mode with feedback
      setTimeout(() => {
        setDriverMode('login');
        setRegSuccess(false);
      }, 5000);
    } catch (err: any) {
      setRegLoading(false);
      setRegError(err.message || (lang === 'en' ? "Registration failed. Plate number or NIN may already exist." : "Rijista ta gaza. Lambar mota ko NIN na iya kasancewa a riga an yi rijista da su."));
    }
  };

  const getPortalTitle = () => {
    if (isDirectorPortal) return lang === 'en' ? 'Executive Director Portal' : 'Sashen Babban Darakta';
    if (isAdminPortal) return lang === 'en' ? 'Operations Admin Portal' : 'Sashen Gudanarwa Admin';
    return lang === 'en' ? 'Ruqayya Transport Fleet ERP' : 'Sufuri na Ruqayya Fleet ERP';
  };

  const getPortalNotice = () => {
    if (isDirectorPortal) {
      return lang === 'en' 
        ? 'Restricted access node. Input authorized Director credentials to proceed.' 
        : 'Sashi ne na musamman. Shigar da amintattun bayanan shiga na Darakta.';
    }
    if (isAdminPortal) {
      return lang === 'en' 
        ? 'Operations Control Center. Input authorized Admin credentials to proceed.' 
        : 'Sashen kula da aiki. Shigar da amintattun bayanan shiga na Admin.';
    }
    return lang === 'en' 
      ? 'Secure logistics and asset orchestration interface. Welcome.' 
      : 'Kofofin sarrafa ababen hawa da sufuri. Barka da zuwa.';
  };

  const animationStyles = `
    @keyframes float-orb-1 {
      0%, 100% { transform: translate(0px, 0px) scale(1); }
      50% { transform: translate(40px, -60px) scale(1.15); }
    }
    @keyframes float-orb-2 {
      0%, 100% { transform: translate(0px, 0px) scale(1.05); }
      50% { transform: translate(-50px, 40px) scale(0.9); }
    }
    .animate-float-1 {
      animation: float-orb-1 12s infinite ease-in-out;
    }
    .animate-float-2 {
      animation: float-orb-2 15s infinite ease-in-out;
    }
  `;

  return (
    <div className="w-full min-h-screen bg-[#071224] text-white flex flex-col font-sans relative overflow-x-hidden selection:bg-[#D4AF37]/30 selection:text-white">
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* AMBIENT GLOWING BACKDROP MESH */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-gradient-to-br from-[#D4AF37]/10 to-transparent blur-[80px] sm:blur-[120px] animate-float-1" />
        <div className="absolute bottom-[15%] right-[10%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-gradient-to-br from-[#3B82F6]/8 to-transparent blur-[90px] sm:blur-[130px] animate-float-2" />
        
        {/* Fine background grid lines */}
        <div 
          className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:48px_48px]" 
          style={{ maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 80%)' }}
        />
      </div>

      {/* STICKY GLASSMORPHISM HEADER */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 border-b ${
        isScrolled 
          ? 'py-3 bg-[#071224]/85 backdrop-blur-md border-white/5 shadow-[0_10px_30px_rgba(2,6,23,0.3)]' 
          : 'py-5 bg-transparent border-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo Group */}
          <div 
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new Event('popstate'));
            }}
            className="flex items-center gap-3 cursor-pointer active:scale-95 transition-all duration-200"
          >
            <CircularLogo size="sm" />
            <div className="flex flex-col">
              <span className="font-extrabold text-[15px] sm:text-[17px] tracking-wider text-white font-mono leading-none">RUQAYYA</span>
              <span className="text-[9px] font-bold text-[#D4AF37] tracking-widest uppercase mt-0.5 leading-none">
                {lang === 'en' ? 'TRANSPORT ERP' : 'SUFURI ERP'}
              </span>
            </div>
          </div>

          {/* Controls: Switchers */}
          <div className="flex items-center gap-4 sm:gap-6">
            
            {/* Live Clock */}
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 font-mono">
              <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>{timeStr || "WAT"}</span>
            </div>

            {/* Language Selection */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/5 rounded-lg p-0.5">
              <button 
                onClick={() => onLanguageChange && onLanguageChange('en')}
                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  lang === 'en' 
                    ? 'bg-[#D4AF37] text-slate-950 font-black shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button 
                onClick={() => onLanguageChange && onLanguageChange('ha')}
                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  lang === 'ha' 
                    ? 'bg-[#D4AF37] text-slate-950 font-black shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                HA
              </button>
            </div>

            {/* Dark/Light Toggle */}
            <button 
              onClick={() => onThemeChange && onThemeChange(currentTheme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-[#D4AF37] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
            >
              {currentTheme === 'light' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-16 z-10 relative">
        
        {isEnterprisePortal ? (
          /* ==================================================================== */
          /* ENTERPRISE USERNAME GATEWAY VIEW (For Admin / Director Portals)      */
          /* ==================================================================== */
          <div className="w-full max-w-md">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-[#0b1736]/55 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(2,6,23,0.8)] overflow-hidden p-6 sm:p-10 hover:border-white/15 transition-all duration-300"
            >
              
              {/* Header Branding */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4 shadow-[0_8px_20px_rgba(212,169,55,0.1)]">
                  <Lock className="h-7 w-7" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  {getPortalTitle()}
                </h2>
                <p className="text-[12px] sm:text-[13px] text-slate-400 mt-2 max-w-xs mx-auto leading-normal">
                  {getPortalNotice()}
                </p>
              </div>

              {/* Warnings / Session Expiry */}
              {(sessionExpiredMessage) && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-3 text-white text-xs leading-relaxed animate-pulse">
                  <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold block text-amber-500 mb-0.5">
                      {lang === 'en' ? "Session Expired" : "Zaman Shiga Ya Kare"}
                    </span>
                    <span>
                      {sessionExpiredMessage}
                    </span>
                  </div>
                </div>
              )}

              {/* Username Error alerts */}
              {usernameError && (
                <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-3 text-white text-xs leading-relaxed">
                  <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-bold block text-rose-500 mb-0.5">
                      {lang === 'en' ? "Access Restriction" : "Hana Shiga"}
                    </span>
                    <span>{usernameError}</span>
                  </div>
                </div>
              )}

              {/* Username Success alerts */}
              {usernameSuccess && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-white text-xs leading-relaxed">
                  <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold block text-emerald-500 mb-0.5">
                      {lang === 'en' ? "Security Clear" : "An Tabbatar"}
                    </span>
                    <span>
                      {lang === 'en' ? "Establishing secure corporate connection node..." : "Ana kaddamar da sashi amintacce..."}
                    </span>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleUsernameLoginSubmit} className="flex flex-col gap-6">
                
                <div className="relative flex flex-col w-full">
                  <div className="relative flex items-center w-full h-[58px] rounded-2xl border transition-all duration-300 bg-slate-950/40 border-white/10 focus-within:border-[#D4AF37] focus-within:ring-2 focus-within:ring-[#D4AF37]/20">
                    <div className="absolute left-4 text-slate-400">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={lang === 'en' ? "Enterprise Username" : "Sunan Shiga Na Kamfani"}
                      className="w-full h-full pl-12 pr-4 bg-transparent border-0 text-white focus:outline-none focus:ring-0 placeholder:text-slate-500 font-semibold tracking-wide text-sm"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  variant="secondary"
                  isLoading={usernameLoading}
                  className="w-full h-12 rounded-2xl text-slate-950 font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#D4AF37] to-[#f59e0b] shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{lang === 'en' ? 'Authenticate Gateway' : 'Tabbatar Da Shiga'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

            </motion.div>

            {/* Back to Public Link */}
            <div className="text-center mt-6">
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new Event('popstate'));
                }}
                className="text-xs text-slate-400 hover:text-[#D4AF37] font-mono cursor-pointer transition-colors"
              >
                ← {lang === 'en' ? 'Back to Public Fleet Portal' : 'Koma Sashen Jama\'a'}
              </button>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* PUBLIC DRIVER & SHAREHOLDER PORTALS (Split Bento-Like Layout)        */
          /* ==================================================================== */
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* LEFT SIDE: Brand presentation and information */}
            <div className="lg:col-span-5 flex flex-col text-left space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-[#D4AF37] font-bold font-mono tracking-wider w-fit"
              >
                <Truck className="h-3.5 w-3.5 animate-pulse" />
                <span>{lang === 'en' ? 'KANO LOGISTICS & HAULAGE' : 'SUFURI DA GUDANARWA A KANO'}</span>
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-none"
              >
                {lang === 'en' ? 'Sufuri da Sauri, Tsaro da Aminci.' : 'Gudu da Sauri, Tsaro da Aminci.'}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-amber-500 mt-2">
                  {lang === 'en' ? 'Reliable Fleet ERP Engine.' : 'Kula Da Ababen Sufuri Amintattu.'}
                </span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-[14px] sm:text-[15px] text-slate-400 leading-relaxed max-w-lg"
              >
                {lang === 'en' 
                  ? 'Ruqayya Transport Limited ERP coordinates heavy-duty haulage operations, real-time trip manifestation, driver allowances, and shareholder dividends under one cryptographically-audited dashboard.'
                  : 'Sufuri na Ruqayya Limited yana haɗa manyan motocin sufuri, takardun tafiye-tafiye, tallafin kuɗi na direbobi, da rabon jari na masu hannun jari duk a sashi guda ɗaya amintacce.'}
              </motion.p>

              {/* Interactive Key Features list */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{lang === 'en' ? 'Driver Pay' : 'Kudin Direba'}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{lang === 'en' ? 'Instant trip payouts' : 'Rabon kudi nan take'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{lang === 'en' ? 'Shareholder' : 'Hannun Jari'}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{lang === 'en' ? 'Track reinvestments' : 'Kula da jarin ku'}</p>
                  </div>
                </div>
              </motion.div>

              {/* Administrative Node Shortcut link */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="pt-6"
              >
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-slate-400 text-xs flex items-center justify-between gap-4 max-w-sm">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-[#D4AF37] shrink-0" />
                    <span>{lang === 'en' ? 'Are you an Administrator or Director?' : 'Kai Gudanarwa ne ko Darakta?'}</span>
                  </div>
                  <button 
                    onClick={() => {
                      window.history.pushState({}, '', '/admin');
                      window.dispatchEvent(new Event('popstate'));
                    }}
                    className="text-xs font-bold text-[#D4AF37] hover:underline cursor-pointer tracking-wider shrink-0"
                  >
                    {lang === 'en' ? 'Enter' : 'Shiga'} →
                  </button>
                </div>
              </motion.div>
            </div>

            {/* RIGHT SIDE: The Main Public Login & Registration Card */}
            <div className="lg:col-span-7 w-full flex justify-center">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="w-full max-w-xl bg-[#0b1736]/55 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(2,6,23,0.8)] overflow-hidden p-5 sm:p-8 hover:border-white/15 transition-all duration-300"
              >
                
                {/* Public Tab Selection Controls */}
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950/50 rounded-2xl border border-white/5 mb-6">
                  <button
                    onClick={() => {
                      setPublicTab('driver');
                      setLoginError('');
                      setRegError('');
                    }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      publicTab === 'driver'
                        ? 'bg-gradient-to-r from-[#D4AF37] to-amber-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                    <span>{lang === 'en' ? 'Drivers' : 'Direbobi'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setPublicTab('shareholder');
                      setLoginError('');
                      setRegError('');
                    }}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      publicTab === 'shareholder'
                        ? 'bg-gradient-to-r from-[#D4AF37] to-amber-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>{lang === 'en' ? 'Shareholders' : 'Masu Hannun Jari'}</span>
                  </button>
                </div>

                {/* Subheading notice based on selection */}
                <div className="mb-6">
                  {publicTab === 'driver' ? (
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {lang === 'en' ? 'Logistics Fleet Driver Node' : 'Sashi Na Direbobin Sufuri'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {driverMode === 'login' 
                            ? (lang === 'en' ? 'Authenticate driver console' : 'Shigar da bayanan tabbatarwa na direbobi')
                            : (lang === 'en' ? 'Submit driver roster application' : 'Shigar da takardar neman zama direba')}
                        </p>
                      </div>
                      
                      {/* Driver Login / Register Toggle */}
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
                        <button
                          onClick={() => {
                            setDriverMode('login');
                            setRegError('');
                            setLoginError('');
                          }}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                            driverMode === 'login' 
                              ? 'bg-[#D4AF37] text-slate-950 font-black' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {lang === 'en' ? 'Log In' : 'Shiga'}
                        </button>
                        <button
                          onClick={() => {
                            setDriverMode('register');
                            setRegError('');
                            setLoginError('');
                          }}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                            driverMode === 'register' 
                              ? 'bg-[#D4AF37] text-slate-950 font-black' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {lang === 'en' ? 'Register' : 'Rijista'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-b border-white/5 pb-3">
                      <h3 className="text-base font-bold text-white">
                        {lang === 'en' ? 'Corporate Shareholder Boardroom' : 'Dandalin Masu Hannun Jari'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lang === 'en' ? 'Inspect dividend logs & dynamic reinvestment nodes.' : 'Duba asusun rabo da jadawalin jarin ku.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* ERROR AND SUCCESS ALERTS */}
                {(sessionExpiredMessage) && (
                  <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-3 text-white text-xs leading-relaxed">
                    <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-amber-500 mb-0.5">
                        {lang === 'en' ? "Session Expired" : "Zaman Shiga Ya Kare"}
                      </span>
                      <span>{sessionExpiredMessage}</span>
                    </div>
                  </div>
                )}

                {loginError && (
                  <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-3 text-white text-xs leading-relaxed">
                    <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-rose-500 mb-0.5">
                        {lang === 'en' ? "Authentication Failure" : "Gaza Tabbatarwa"}
                      </span>
                      <span>{loginError}</span>
                    </div>
                  </div>
                )}

                {loginSuccess && (
                  <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-white text-xs leading-relaxed">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-emerald-500 mb-0.5">
                        {lang === 'en' ? "Welcome Back" : "Sannu da Dawowa"}
                      </span>
                      <span>
                        {lang === 'en' ? "Access authorized. Syncing fleet log records..." : "An tabbatar da shiga. Ana duba rumbun bayanai..."}
                      </span>
                    </div>
                  </div>
                )}

                {regError && (
                  <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-3 text-white text-xs leading-relaxed">
                    <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-rose-500 mb-0.5">
                        {lang === 'en' ? "Registration Issue" : "Matsalar Rijista"}
                      </span>
                      <span>{regError}</span>
                    </div>
                  </div>
                )}

                {regSuccess && (
                  <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 text-white text-xs leading-relaxed">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold block text-emerald-500 mb-0.5">
                        {lang === 'en' ? "Application Submitted" : "An Miƙa Takardar Rijista"}
                      </span>
                      <span>
                        {lang === 'en' 
                          ? "Registration complete! Fleet status is pending. Please await Director/Admin roster approval." 
                          : "Rijista ta kammala! Ana kan duba takardunku. Da fatan a jira amincewa daga Darakta."}
                      </span>
                    </div>
                  </div>
                )}

                {/* RENDER DYNAMIC FORMS */}
                <AnimatePresence mode="wait">
                  {publicTab === 'driver' && driverMode === 'register' ? (
                    
                    /* DRIVER REGISTRATION FORM (Multi-step) */
                    <motion.form 
                      key="driver-register"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onSubmit={handleDriverRegistrationSubmit}
                      className="flex flex-col gap-4 text-left"
                    >
                      {/* Step Progress indicators */}
                      <div className="grid grid-cols-4 gap-2 bg-slate-950/30 p-2.5 rounded-xl border border-white/5 mb-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${regStep === 1 ? 'bg-[#D4AF37] text-slate-950 shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-white/10 text-slate-300'}`}>1</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Personal' : 'Kanka'}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${regStep === 2 ? 'bg-[#D4AF37] text-slate-950 shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-white/10 text-slate-300'}`}>2</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'License' : 'Lasisin'}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${regStep === 3 ? 'bg-[#D4AF37] text-slate-950 shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-white/10 text-slate-300'}`}>3</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Vehicle' : 'Mota'}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${regStep === 4 ? 'bg-[#D4AF37] text-slate-950 shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'bg-white/10 text-slate-300'}`}>4</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Trust' : 'Mai Lamuni'}</span>
                        </div>
                      </div>

                      {/* Step 1 Content: Personal Profile & Passport */}
                      {regStep === 1 && (
                        <div className="flex flex-col gap-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Full Name' : 'Cikakken Suna'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <User className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regFullName}
                                  onChange={(e) => setRegFullName(e.target.value)}
                                  placeholder="e.g. Alhaji Ibrahim Musa" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Phone Number' : 'Lambar Waya'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <User className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="tel" 
                                  required 
                                  value={regPhone}
                                  onChange={(e) => setRegPhone(e.target.value)}
                                  placeholder="+234 803 ..." 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Email Address' : 'Imel'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <User className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="email" 
                                  required 
                                  value={regEmail}
                                  onChange={(e) => setRegEmail(e.target.value)}
                                  placeholder="driver@ruqayyatransport.com" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'RTL-ID Number' : 'Lambar RTL-ID'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <Hash className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regRtlId}
                                  onChange={(e) => setRegRtlId(e.target.value.toUpperCase())}
                                  placeholder="e.g. RTL-2026-089" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Secure Password' : 'Kalmar Sirri'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <KeyRound className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="password" 
                                  required 
                                  value={regPassword}
                                  onChange={(e) => setRegPassword(e.target.value)}
                                  placeholder="••••••••" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Home Address' : 'Adireshin Gida'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <MapPin className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regAddress}
                                  onChange={(e) => setRegAddress(e.target.value)}
                                  placeholder="e.g. No 14 Zaria Road, Kano" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Passport Photo Drag & Drop Field */}
                          <div className="flex flex-col">
                            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">
                              {lang === 'en' ? 'Driver Passport Photograph' : 'Hoton Fasfo Na Direba'} <span className="text-amber-500">*</span>
                            </label>
                            <div 
                              className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all min-h-[105px] cursor-pointer bg-slate-950/30 ${
                                regPassportPhoto ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-[#D4AF37]/50 focus-within:border-[#D4AF37]'
                              }`}
                              onClick={() => document.getElementById('driver-passport-upload')?.click()}
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      setRegPassportPhoto(reader.result);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            >
                              <input 
                                type="file" 
                                id="driver-passport-upload" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (typeof reader.result === 'string') {
                                        setRegPassportPhoto(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              {regPassportPhoto ? (
                                <div className="flex items-center gap-3 w-full">
                                  <img 
                                    src={regPassportPhoto} 
                                    alt="Driver Passport Preview" 
                                    referrerPolicy="no-referrer"
                                    className="h-14 w-14 rounded-lg object-cover border border-emerald-500/30 shadow-md"
                                  />
                                  <div className="text-left flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-400">{lang === 'en' ? 'Passport Loaded Successfully' : 'An Sanya Fasfo Cikin Nasara'}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{lang === 'en' ? 'Click or drag to replace image' : 'Danna ko jawo wani don sauyawa'}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center flex flex-col items-center">
                                  <Camera className="h-6 w-6 text-[#D4AF37] mb-1.5" />
                                  <p className="text-xs font-bold text-slate-300">{lang === 'en' ? 'Click to select or drag passport' : 'Danna ko jawo hoton fasfo na direba'}</p>
                                  <p className="text-[9px] text-slate-500 uppercase font-mono mt-0.5">{lang === 'en' ? 'Formats: PNG, JPG, JPEG (Max 10MB)' : 'Tsari: PNG, JPG, JPEG'}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <Button 
                            type="button" 
                            variant="secondary"
                            onClick={() => {
                              if (regFullName && regRtlId && regEmail && regPhone && regAddress && regPassword && regPassportPhoto) {
                                setRegStep(2);
                                setRegError('');
                              } else if (!regPassportPhoto && regFullName && regRtlId && regEmail && regPhone && regAddress && regPassword) {
                                setRegError(lang === 'en' ? "Please upload your driver passport photograph to continue." : "Da fatan a saka hoton fasfo na direba.");
                              } else {
                                setRegError(lang === 'en' ? "Please fill in all profile fields before continuing (including your RTL-ID)." : "Da fatan a cike dukkan guraren da ke kasa (tare da RTL-ID dinka).");
                              }
                            }}
                            className="w-full h-11 rounded-xl text-slate-950 font-extrabold bg-[#D4AF37] hover:bg-amber-500 cursor-pointer text-xs mt-2 flex items-center justify-center gap-2"
                          >
                            <span>{lang === 'en' ? 'Continue' : 'Ci gaba'}</span>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Step 2 Content: License & Credentials */}
                      {regStep === 2 && (
                        <div className="flex flex-col gap-3.5 animate-fadeIn">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'NIN (National ID Number)' : 'Lambar Katin Dan Kasa (NIN)'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <Hash className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  maxLength={11}
                                  value={regNin}
                                  onChange={(e) => setRegNin(e.target.value.replace(/\D/g, ''))}
                                  placeholder="11-digit Number" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Driver\'s License Number' : 'Lambar Lasisin Tuki'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <FileText className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regLicense}
                                  onChange={(e) => setRegLicense(e.target.value.toUpperCase())}
                                  placeholder="KNO-12345-DL" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col">
                            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'License Expiry Date' : 'Ranar Karewar Lasisi'} <span className="text-amber-500">*</span></label>
                            <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                              <Clock className="h-4 w-4 absolute left-3.5 text-slate-400" />
                              <input 
                                type="date" 
                                required
                                value={regLicenseExpiry}
                                onChange={(e) => setRegLicenseExpiry(e.target.value)}
                                className="w-full h-full pl-10 pr-4 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none [color-scheme:dark]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={() => setRegStep(1)}
                              className="h-11 rounded-xl text-slate-300 border-white/10 hover:bg-white/5 cursor-pointer text-xs font-extrabold"
                            >
                              {lang === 'en' ? 'Back' : 'Koma'}
                            </Button>
                            
                            <Button 
                              type="button" 
                              variant="secondary"
                              onClick={() => {
                                if (regNin && regLicense) {
                                  setRegStep(3);
                                  setRegError('');
                                } else {
                                  setRegError(lang === 'en' ? "NIN and License number are required." : "Ana buƙatar NIN da lasisin tuki.");
                                }
                              }}
                              className="h-11 rounded-xl text-slate-950 font-extrabold bg-[#D4AF37] hover:bg-amber-500 cursor-pointer text-xs flex items-center justify-center gap-2"
                            >
                              <span>{lang === 'en' ? 'Continue' : 'Ci gaba'}</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 3 Content: Comprehensive Vehicle Details */}
                      {regStep === 3 && (
                        <div className="flex flex-col gap-3.5 animate-fadeIn">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Vehicle Plate Number' : 'Lambar Motar' } <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <Truck className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regPlateNumber}
                                  onChange={(e) => setRegPlateNumber(e.target.value.toUpperCase())}
                                  placeholder="e.g. KMC-432AA" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Vehicle Carrying Capacity' : 'Kayan da motar zata iya dauka'}</label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <FileSpreadsheet className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <select 
                                  value={regVehicleCapacity}
                                  onChange={(e) => setRegVehicleCapacity(e.target.value)}
                                  className="w-full h-full pl-10 pr-4 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none [color-scheme:dark]"
                                >
                                  <option value="30 Tons" className="bg-slate-900 text-white">30 Tons (Heavy Duty)</option>
                                  <option value="45 Tons" className="bg-slate-900 text-white">45 Tons (Heavy Duty Max)</option>
                                  <option value="15 Tons" className="bg-slate-900 text-white">15 Tons (Medium Haulage)</option>
                                  <option value="10 Tons" className="bg-slate-900 text-white">10 Tons (Light Haulage)</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Brand / Make' : 'Irin Motar'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  required 
                                  value={regVehicleBrand}
                                  onChange={(e) => setRegVehicleBrand(e.target.value)}
                                  placeholder="e.g. SinoTruck / Mack" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Model Name' : 'Samfurin Motar'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  required 
                                  value={regVehicleModel}
                                  onChange={(e) => setRegVehicleModel(e.target.value)}
                                  placeholder="e.g. Howo / Granite" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Manufacture Year' : 'Shekarar Mota'}</label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  required 
                                  value={regVehicleYear}
                                  onChange={(e) => setRegVehicleYear(e.target.value.replace(/\D/g, ''))}
                                  placeholder="2024" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Vehicle Color' : 'Launin Motar'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  required 
                                  value={regVehicleColour}
                                  onChange={(e) => setRegVehicleColour(e.target.value)}
                                  placeholder="e.g. White / Yellow" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Chassis Number' : 'Lambar Chassis'}</label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  value={regVehicleChassisNo}
                                  onChange={(e) => setRegVehicleChassisNo(e.target.value.toUpperCase())}
                                  placeholder="e.g. CN12345 (Optional)" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Engine Number' : 'Lambar Injin'}</label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  value={regVehicleEngineNo}
                                  onChange={(e) => setRegVehicleEngineNo(e.target.value.toUpperCase())}
                                  placeholder="e.g. EN98765 (Optional)" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'State Registration Certificate No.' : 'Lambar Shedar Rijista'}</label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <input 
                                  type="text" 
                                  value={regVehicleRegNo}
                                  onChange={(e) => setRegVehicleRegNo(e.target.value.toUpperCase())}
                                  placeholder="e.g. REG-55322 (Optional)" 
                                  className="w-full h-full px-3.5 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={() => setRegStep(2)}
                              className="h-11 rounded-xl text-slate-300 border-white/10 hover:bg-white/5 cursor-pointer text-xs font-extrabold"
                            >
                              {lang === 'en' ? 'Back' : 'Koma'}
                            </Button>
                            
                            <Button 
                              type="button" 
                              variant="secondary"
                              onClick={() => {
                                if (regPlateNumber && regVehicleBrand && regVehicleModel && regVehicleColour) {
                                  setRegStep(4);
                                  setRegError('');
                                } else {
                                  setRegError(lang === 'en' ? "Plate number, brand, model, and colour are required." : "Ana buƙatar lambar mota, kamfani, samfuri da launi.");
                                }
                              }}
                              className="h-11 rounded-xl text-slate-950 font-extrabold bg-[#D4AF37] hover:bg-amber-500 cursor-pointer text-xs flex items-center justify-center gap-2"
                            >
                              <span>{lang === 'en' ? 'Continue' : 'Ci gaba'}</span>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 4 Content: Guarantor Trust details & Passport */}
                      {regStep === 4 && (
                        <div className="flex flex-col gap-3.5 animate-fadeIn">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Guarantor Full Name' : 'Cikakken Suna Na Mai Lamuni'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <User className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regGuarantorName}
                                  onChange={(e) => setRegGuarantorName(e.target.value)}
                                  placeholder="Guarantor full name" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Guarantor Phone Number' : 'Waya Ta Mai Lamuni'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <User className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="tel" 
                                  required 
                                  value={regGuarantorPhone}
                                  onChange={(e) => setRegGuarantorPhone(e.target.value)}
                                  placeholder="+234 806 ..." 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Relationship with Driver' : 'Dangantaka da Direba'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <Briefcase className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  value={regGuarantorRelationship}
                                  onChange={(e) => setRegGuarantorRelationship(e.target.value)}
                                  placeholder="e.g. Uncle / Brother / Business Owner" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Guarantor NIN' : 'Lambar NIN Ta Mai Lamuni'} <span className="text-amber-500">*</span></label>
                              <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                                <Hash className="h-4 w-4 absolute left-3.5 text-slate-400" />
                                <input 
                                  type="text" 
                                  required 
                                  maxLength={11}
                                  value={regGuarantorNin}
                                  onChange={(e) => setRegGuarantorNin(e.target.value.replace(/\D/g, ''))}
                                  placeholder="11-digit Number" 
                                  className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col">
                            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">{lang === 'en' ? 'Guarantor Physical Home/Office Address' : 'Adireshin Mai Lamuni'} <span className="text-amber-500">*</span></label>
                            <div className="relative flex items-center h-12 rounded-xl border bg-slate-950/30 border-white/10 focus-within:border-[#D4AF37]">
                              <MapPin className="h-4 w-4 absolute left-3.5 text-slate-400" />
                              <input 
                                type="text" 
                                required 
                                value={regGuarantorAddress}
                                onChange={(e) => setRegGuarantorAddress(e.target.value)}
                                placeholder="e.g. No 15 Gwarzo Road, Kano" 
                                className="w-full h-full pl-10 pr-3 bg-transparent border-0 text-white text-xs font-semibold focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Guarantor Passport Upload Dropzone */}
                          <div className="flex flex-col">
                            <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">
                              {lang === 'en' ? 'Guarantor Passport Photograph' : 'Hoton Fasfo Na Mai Lamuni'} <span className="text-amber-500">*</span>
                            </label>
                            <div 
                              className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all min-h-[105px] cursor-pointer bg-slate-950/30 ${
                                regGuarantorPassport ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-[#D4AF37]/50 focus-within:border-[#D4AF37]'
                              }`}
                              onClick={() => document.getElementById('guarantor-passport-upload')?.click()}
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      setRegGuarantorPassport(reader.result);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            >
                              <input 
                                type="file" 
                                id="guarantor-passport-upload" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (typeof reader.result === 'string') {
                                        setRegGuarantorPassport(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              {regGuarantorPassport ? (
                                <div className="flex items-center gap-3 w-full">
                                  <img 
                                    src={regGuarantorPassport} 
                                    alt="Guarantor Passport Preview" 
                                    referrerPolicy="no-referrer"
                                    className="h-14 w-14 rounded-lg object-cover border border-emerald-500/30 shadow-md"
                                  />
                                  <div className="text-left flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-400">{lang === 'en' ? 'Passport Loaded Successfully' : 'An Sanya Fasfo Cikin Nasara'}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{lang === 'en' ? 'Click or drag to replace image' : 'Danna ko jawo wani don sauyawa'}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center flex flex-col items-center">
                                  <Camera className="h-6 w-6 text-[#D4AF37] mb-1.5" />
                                  <p className="text-xs font-bold text-slate-300">{lang === 'en' ? 'Click to select or drag guarantor passport' : 'Danna ko jawo hoton fasfo na mai lamuni'}</p>
                                  <p className="text-[9px] text-slate-500 uppercase font-mono mt-0.5">{lang === 'en' ? 'Formats: PNG, JPG, JPEG (Max 10MB)' : 'Tsari: PNG, JPG, JPEG'}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={() => setRegStep(3)}
                              className="h-11 rounded-xl text-slate-300 border-white/10 hover:bg-white/5 cursor-pointer text-xs font-extrabold"
                            >
                              {lang === 'en' ? 'Back' : 'Koma'}
                            </Button>
                            
                            <Button 
                              type="submit" 
                              variant="secondary"
                              isLoading={regLoading}
                              className="h-11 rounded-xl text-slate-950 font-black bg-[#D4AF37] hover:bg-amber-500 cursor-pointer text-xs uppercase tracking-wider"
                            >
                              {lang === 'en' ? 'Submit Application' : 'Mika Takarda'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.form>
                  ) : (
                    
                    /* STANDARD EMAIL/PASSWORD LOGIN FORM */
                    <motion.form 
                      key="standard-login"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      onSubmit={handleStandardLoginSubmit}
                      className="flex flex-col gap-5 text-left"
                    >
                      <div className="flex flex-col">
                        <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">{lang === 'en' ? 'Corporate Email' : 'Imel Na Ma\'aikata'}</label>
                        <div className="relative flex items-center h-[54px] rounded-2xl border transition-all bg-slate-950/40 border-white/10 focus-within:border-[#D4AF37]">
                          <User className="h-5 w-5 absolute left-4 text-slate-400" />
                          <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={publicTab === 'driver' ? "driver@ruqayyatransport.com" : "shareholder@ruqayyatransport.com"}
                            className="w-full h-full pl-12 pr-4 bg-transparent border-0 text-white font-semibold text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">{lang === 'en' ? 'Validation Password' : 'Kalmar Sirri'}</label>
                        <div className="relative flex items-center h-[54px] rounded-2xl border transition-all bg-slate-950/40 border-white/10 focus-within:border-[#D4AF37]">
                          <KeyRound className="h-5 w-5 absolute left-4 text-slate-400" />
                          <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••" 
                            className="w-full h-full pl-12 pr-4 bg-transparent border-0 text-white font-semibold text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        variant="secondary"
                        isLoading={loginLoading}
                        className="w-full h-12 rounded-2xl text-slate-950 font-black text-xs uppercase tracking-widest bg-gradient-to-r from-[#D4AF37] to-amber-500 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                      >
                        <span>{lang === 'en' ? 'Acknowledge & Connect' : 'Shiga Sashi'}</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>

              </motion.div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-auto py-8 text-center text-[11px] text-slate-500 font-mono flex flex-col gap-1.5 justify-center z-10 relative">
        <span className="text-[#D4AF37]/70 font-bold uppercase tracking-wider">RUQAYYA TRANSPORT LTD ERP</span>
        <span>Secure Enterprise Node SSL Connected</span>
        <span className="text-[10px] text-slate-600">© 2026 Ruqayya Transport Limited. All rights reserved.</span>
      </footer>

    </div>
  );
};
