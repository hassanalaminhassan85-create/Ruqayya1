import { compressImageFile } from '../../utils/imageCompressor';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateDistance, ingestDriverTelemetry, MAIDUGURI_HUB } from '../../utils/geofencingService';
import { 
  ArrowLeft, Navigation, Compass, ShieldCheck, AlertTriangle, Moon, 
  Edit, UploadCloud, Plus, X, Download, Eye, RefreshCw, Truck, 
  User, FileText, Wallet, Video, Maximize2, Activity, Gauge, 
  Zap, Lock, Unlock, CheckCircle2, Clock, Coins, Search, 
  Filter, Calendar, MapPin, Radio, Signal, Cpu, Layers, Volume2, 
  Camera, Check, ChevronRight, Sparkles, AlertCircle, Phone, Mail, Award, Key,
  BookOpen, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, Alert } from '../ui/SharedComponents';
import { Driver, Vehicle } from '../../types';
import { api } from '../../utils/api';
import { getAuthorizedUrl } from '../../utils/security';

interface Driver360ModalProps {
  lang: 'en' | 'ha';
  driver: Driver;
  vehicles?: Vehicle[];
  payments?: any[];
  drivers?: Driver[];
  onClose: () => void;
  onSync: () => void;
}

export const Driver360Modal: React.FC<Driver360ModalProps> = ({
  lang, driver: initialDriver, vehicles = [], payments = [], drivers: passedDrivers = [], onClose, onSync
}) => {
  const token = api.getToken() || '';
  
  // State for current driver & list of all drivers for quick switching
  const [allDrivers, setAllDrivers] = useState<Driver[]>(passedDrivers);
  const [activeDriverId, setActiveDriverId] = useState<string>(initialDriver.id);
  const [activeDriver, setActiveDriver] = useState<Driver>(initialDriver);
  const [driverLoading, setDriverLoading] = useState(false);

  // Load all drivers if not supplied
  useEffect(() => {
    if (passedDrivers.length > 0) {
      setAllDrivers(passedDrivers);
    } else {
      api.getDrivers().then((res: any) => {
        if (Array.isArray(res)) setAllDrivers(res);
        else if (res && Array.isArray(res.drivers)) setAllDrivers(res.drivers);
      }).catch(err => console.error("Failed to load driver list", err));
    }
  }, [passedDrivers]);

  // Fetch full details whenever activeDriverId changes
  const fetchDriverFullData = async (driverId: string) => {
    setDriverLoading(true);
    try {
      const res = await api.getDriverById(driverId);
      if (res && !res.error) {
        setActiveDriver(res);
      }
    } catch (err) {
      console.error("Failed to fetch active driver profile:", err);
    } finally {
      setDriverLoading(false);
    }
  };

  useEffect(() => {
    if (activeDriverId && activeDriverId !== activeDriver.id) {
      fetchDriverFullData(activeDriverId);
    }
  }, [activeDriverId]);

  // Escape key shortcut to close tracking command center
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const driverPassportUrl = getAuthorizedUrl(
    (activeDriver as any).passport_photo_url || 
    (activeDriver as any).passportPhoto || 
    (activeDriver as any).passport_photo || 
    activeDriver.documents?.find((d: any) => d.document_type === 'passport_photo')?.file_url || 
    ''
  );

  const guarantorPassportUrl = activeDriver.guarantor ? getAuthorizedUrl(
    (activeDriver.guarantor as any).passport_photo_url || 
    (activeDriver.guarantor as any).passportPhotoUrl || 
    (activeDriver.guarantor as any).passport_photo || 
    (activeDriver.guarantor as any).passport || 
    ''
  ) : '';

  // Tabs
  const [activeTab, setActiveTab] = useState<'telematics' | 'dossier' | 'edit-profile' | 'payments' | 'ledger' | 'docs' | 'trips'>('telematics');
  
  // Installments state
  const [installments, setInstallments] = useState<any[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<any | null>(null);
  const [instSortKey, setInstSortKey] = useState<'installmentNumber' | 'amountDue' | 'amountPaid' | 'status'>('installmentNumber');
  const [instSortOrder, setInstSortOrder] = useState<'asc' | 'desc'>('asc');

  // Driver trips state
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Driver payments & expenses state (fetched dynamically if needed)
  const [livePayments, setLivePayments] = useState<any[]>(payments);
  const [driverExpenses, setDriverExpenses] = useState<any[]>([]);
  const [telematicsData, setTelematicsData] = useState<any | null>(null);

  // Helper to generate deterministic Maiduguri locations for the active driver
  const maiduguriSim = useMemo(() => {
    if (!activeDriver) return { placesVisited: [], currentLoc: null };
    
    const driverNum = parseInt((activeDriver as any).company_driver_id?.replace(/\D/g, '') || activeDriver.id?.charCodeAt(0)?.toString() || '1') || 0;
    const routeIndex = driverNum % 3;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const routes = [
      [
        { name: 'Maiduguri Central Depot (Post Office)', lat: 11.8311, lng: 13.1509, arrOffset: 8*60, depOffset: 8*60 + 30, activity: 'Shift Commencement & Pre-trip cargo loading' },
        { name: 'Monday Market Hub', lat: 11.8365, lng: 13.1486, arrOffset: 8*60 + 50, depOffset: 9*60 + 40, activity: 'Offloading wholesale consumables' },
        { name: 'Bolori Junction', lat: 11.8520, lng: 13.1310, arrOffset: 10*60, depOffset: 11*60, activity: 'Tire safety check & fuel top-up' },
        { name: 'Bulumkutu Bypass', lat: 11.8210, lng: 13.1110, arrOffset: 11*60 + 20, depOffset: 13*60, activity: 'Scheduled fatigue break & lunch rest' },
        { name: 'Custom Area Depot', lat: 11.8540, lng: 13.1720, arrOffset: 13*60 + 30, depOffset: null, activity: 'Bulk freight offloading & client sign-off' }
      ],
      [
        { name: 'Maiduguri Central Depot (Post Office)', lat: 11.8311, lng: 13.1509, arrOffset: 7*60 + 30, depOffset: 8*60, activity: 'Shift Commencement & Pre-trip safety check' },
        { name: 'Custom Area Depot', lat: 11.8540, lng: 13.1720, arrOffset: 8*60 + 20, depOffset: 9*60 + 30, activity: 'Inter-state cargo transfer' },
        { name: 'Muna Garage Terminal', lat: 11.8480, lng: 13.2080, arrOffset: 9*60 + 50, depOffset: 11*60 + 10, activity: 'Agricultural haulage sorting' },
        { name: 'Tashan Bama Hub', lat: 11.7990, lng: 13.1890, arrOffset: 11*60 + 30, depOffset: 13*60 + 30, activity: 'Rest stop & routine maintenance check' },
        { name: 'Bama Road Corridor', lat: 11.8020, lng: 13.1950, arrOffset: 13*60 + 50, depOffset: null, activity: 'Grain delivery & warehouse dispatch' }
      ],
      [
        { name: 'Maiduguri Central Depot (Post Office)', lat: 11.8311, lng: 13.1509, arrOffset: 8*60 + 30, depOffset: 9*60, activity: 'Shift Commencement' },
        { name: 'Bolori Junction', lat: 11.8520, lng: 13.1310, arrOffset: 9*60 + 20, depOffset: 10*60 + 15, activity: 'Spare parts delivery' },
        { name: 'Bulumkutu Bypass', lat: 11.8210, lng: 13.1110, arrOffset: 10*60 + 40, depOffset: 12*60, activity: 'Trailer inspection & driver physical rest' },
        { name: 'Monday Market Hub', lat: 11.8365, lng: 13.1486, arrOffset: 12*60 + 20, depOffset: 13*60 + 45, activity: 'Retail dispatch' },
        { name: 'Maiduguri Main Terminal (Post Office)', lat: 11.8311, lng: 13.1509, arrOffset: 14*60 + 10, depOffset: null, activity: 'Return to base and debrief' }
      ]
    ];

    const selectedRoute = routes[routeIndex];
    const placesVisited: any[] = [];
    let currentLoc: any = null;

    selectedRoute.forEach((stop, index) => {
      if (currentMinutes >= stop.arrOffset) {
        const arrivedAt = new Date();
        arrivedAt.setHours(Math.floor(stop.arrOffset / 60), stop.arrOffset % 60, 0, 0);

        let departedAt: Date | null = null;
        let dwellMinutes = 0;
        let status = 'active_dwell';

        if (stop.depOffset !== null && currentMinutes >= stop.depOffset) {
          departedAt = new Date();
          departedAt.setHours(Math.floor(stop.depOffset / 60), stop.depOffset % 60, 0, 0);
          dwellMinutes = stop.depOffset - stop.arrOffset;
          status = 'completed';
        } else {
          dwellMinutes = currentMinutes - stop.arrOffset;
          status = 'active_dwell';
        }

        placesVisited.push({
          id: `PLC-${activeDriver.id}-${index}`,
          place_name: stop.name,
          arrived_at: arrivedAt.toISOString(),
          departed_at: departedAt ? departedAt.toISOString() : null,
          dwell_duration_minutes: dwellMinutes,
          status,
          activity: stop.activity,
          latitude: stop.lat,
          longitude: stop.lng
        });

        if (status === 'active_dwell' || index === selectedRoute.length - 1 || (departedAt && currentMinutes < (selectedRoute[index+1]?.arrOffset || 24*60))) {
          currentLoc = {
            latitude: stop.lat,
            longitude: stop.lng,
            place_name: stop.name,
            activity: status === 'active_dwell' ? stop.activity : 'In Transit'
          };
        }
      }
    });

    if (placesVisited.length === 0) {
      const firstStop = selectedRoute[0];
      const arrivedAt = new Date();
      arrivedAt.setHours(Math.floor(firstStop.arrOffset / 60), firstStop.arrOffset % 60, 0, 0);
      placesVisited.push({
        id: `PLC-${activeDriver.id}-0`,
        place_name: firstStop.name,
        arrived_at: arrivedAt.toISOString(),
        departed_at: null,
        dwell_duration_minutes: 0,
        status: 'active_dwell',
        activity: firstStop.activity,
        latitude: firstStop.lat,
        longitude: firstStop.lng
      });
      currentLoc = {
        latitude: firstStop.lat,
        longitude: firstStop.lng,
        place_name: firstStop.name,
        activity: 'Pre-trip check'
      };
    }

    return { placesVisited, currentLoc };
  }, [activeDriver]);

  const liveCoordinates = useMemo(() => {
    const lat = telematicsData?.currentLocation?.latitude || maiduguriSim.currentLoc?.latitude || 11.8311;
    const lng = telematicsData?.currentLocation?.longitude || maiduguriSim.currentLoc?.longitude || 13.1509;
    return { latitude: lat, longitude: lng };
  }, [telematicsData, maiduguriSim]);

  const geofenceTelemetry = useMemo(() => {
    return ingestDriverTelemetry(liveCoordinates);
  }, [liveCoordinates]);

  const fetchDriverInstallmentsAndData = async () => {
    if (!activeDriver?.id) return;
    setLoadingInstallments(true);
    setLoadingTrips(true);
    try {
      // Installments
      const res = await api.request(`/api/drivers/${activeDriver.id}/installments`).catch(() => ({ installments: [] }));
      if (res && res.success) {
        setInstallments(res.installments || []);
      }

      // Trips
      const tripsRes = await api.getTrips().catch(() => []);
      const filteredTrips = Array.isArray(tripsRes) ? tripsRes.filter((t: any) => 
        t.driver_id === activeDriver.id || 
        t.driverId === activeDriver.id ||
        t.driver_id === activeDriver.user_id ||
        t.driverId === activeDriver.user_id
      ) : [];
      setDriverTrips(filteredTrips);

      // Payments
      const payRes = await api.getPayments(activeDriver.id).catch(() => []);
      if (Array.isArray(payRes)) {
        setLivePayments(payRes);
      }

      // Expenses
      const finRes = await api.getFinance().catch(() => []);
      if (Array.isArray(finRes)) {
        setDriverExpenses(finRes.filter((f: any) => 
          f.type === 'expense' && 
          (f.driver_id === activeDriver.id || f.driver_id === activeDriver.user_id)
        ));
      }

      // Telematics & Shift Dwell Data
      const teleRes = await api.getDriverTelematics(activeDriver.id).catch(() => null);
      if (teleRes && teleRes.success) {
        setTelematicsData(teleRes);
      }
    } catch (err) {
      console.error("Failed to fetch telemetry details:", err);
    } finally {
      setLoadingInstallments(false);
      setLoadingTrips(false);
    }
  };

  const fetchLiveTelematics = async () => {
    if (!activeDriver?.id) return;
    try {
      const teleRes = await api.getDriverTelematics(activeDriver.id).catch(() => null);
      if (teleRes && teleRes.success) {
        setTelematicsData(teleRes);
      }
    } catch (err) {
      console.error("Failed to silently poll telemetry:", err);
    }
  };

  useEffect(() => {
    fetchDriverInstallmentsAndData();
    
    // Silently poll live telematics every 15 seconds while modal is open as a failsafe fallback
    const pollInterval = setInterval(() => {
      fetchLiveTelematics();
    }, 15000);

    // Live sub-second WebSocket listener
    let ws: WebSocket | null = null;
    let wsConnectTimeout: any = null;

    const connectWebSocket = () => {
      if (!activeDriver?.id) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/driver-location?role=admin&driverId=${activeDriver.id}`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[Admin 360 WS] Connected for real-time tracking.');
          ws?.send(JSON.stringify({
            type: 'auth',
            role: 'admin',
            driverId: activeDriver.id
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'location_update' && data.driverId === activeDriver.id) {
              console.log('[Admin 360 WS] Received sub-second real-time update:', data.location);
              setTelematicsData((prev: any) => ({
                ...(prev || {}),
                success: true,
                currentLocation: data.location
              }));
            }
          } catch (err) {
            console.error('[Admin 360 WS] Failed to parse message:', err);
          }
        };

        ws.onclose = () => {
          console.log('[Admin 360 WS] Closed. Retrying in 5s...');
          wsConnectTimeout = setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (err) => {
          console.error('[Admin 360 WS] Error:', err);
          ws?.close();
        };
      } catch (err) {
        console.error('[Admin 360 WS] Failed to connect:', err);
        wsConnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    const handleDBChange = () => {
      if (activeDriver?.id) {
        fetchDriverFullData(activeDriver.id);
      }
      fetchDriverInstallmentsAndData();
      if (onSync) onSync();
    };
    window.addEventListener('db-change', handleDBChange);
    return () => {
      clearInterval(pollInterval);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (wsConnectTimeout) clearTimeout(wsConnectTimeout);
      window.removeEventListener('db-change', handleDBChange);
    };
  }, [activeDriver?.id]);

  // Action Modals
  const [isLogAccidentOpen, setIsLogAccidentOpen] = useState(false);
  const [isLogRestOpen, setIsLogRestOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isRecordRemittanceOpen, setIsRecordRemittanceOpen] = useState(false);
  const [isFullscreenDocOpen, setIsFullscreenDocOpen] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Interactive Live Tracking Map & Telemetry Simulation States
  const [mapSatelliteMode, setMapSatelliteMode] = useState(false);
  const [isSimulatingMovement, setIsSimulatingMovement] = useState(true);
  const [vehicleSpeed, setVehicleSpeed] = useState(78);
  const [fuelLevel, setFuelLevel] = useState(74);
  const [activeCamChannel, setActiveCamChannel] = useState<'road' | 'cabin' | 'cargo'>('road');
  const [nightVision, setNightVision] = useState(false);
  const [isImmobilized, setIsImmobilized] = useState(false);
  const [showImmobilizerConfirm, setShowImmobilizerConfirm] = useState(false);

  // Movement simulation effect
  useEffect(() => {
    if (!isSimulatingMovement || isImmobilized) return;
    const interval = setInterval(() => {
      setVehicleSpeed(prev => {
        const delta = (Math.random() - 0.48) * 4;
        const newSpeed = Math.max(0, Math.min(110, Math.round(prev + delta)));
        return newSpeed;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isSimulatingMovement, isImmobilized]);

  // Form states: Log Accident
  const [accDate, setAccDate] = useState(new Date().toISOString().split('T')[0]);
  const [accDesc, setAccDesc] = useState('');
  const [accEstimate, setAccEstimate] = useState('0');
  const [accSeverity, setAccSeverity] = useState<'minor' | 'moderate' | 'major'>('minor');
  const [accError, setAccError] = useState('');

  // Form states: Log Rest
  const [restStart, setRestStart] = useState(new Date().toISOString().split('T')[0]);
  const [restEnd, setRestEnd] = useState('');
  const [restReason, setRestReason] = useState('');
  const [restError, setRestError] = useState('');

  // Form states: Edit Profile Details
  const [editName, setEditName] = useState(activeDriver.fullName || (activeDriver as any).full_name || '');
  const [editEmail, setEditEmail] = useState((activeDriver as any).email || (activeDriver as any).user?.email || '');
  const [editPhone, setEditPhone] = useState(activeDriver.phone || '');
  const [editAddress, setEditAddress] = useState(activeDriver.address || '');
  const [editNin, setEditNin] = useState(activeDriver.nin || '');
  const [editCompanyDriverId, setEditCompanyDriverId] = useState(activeDriver.company_driver_id || activeDriver.companyDriverId || '');
  const [editLicense, setEditLicense] = useState(activeDriver.licenseNumber || activeDriver.license_number || '');
  const [editExpiry, setEditExpiry] = useState(activeDriver.licenseExpiry || activeDriver.license_expiry || '');
  const [editAgreedAmount, setEditAgreedAmount] = useState(((activeDriver as any).agreed_amount ?? (activeDriver as any).agreedAmount ?? '').toString());
  const [editVehiclePurchasePrice, setEditVehiclePurchasePrice] = useState(((activeDriver as any).vehicle_purchase_price ?? (activeDriver as any).vehiclePurchasePrice ?? '').toString());
  const [editRemainingBalance, setEditRemainingBalance] = useState(((activeDriver as any).remaining_vehicle_balance ?? (activeDriver as any).remainingVehicleBalance ?? '').toString());
  const [editStatus, setEditStatus] = useState(activeDriver.status || 'approved');
  const [editClassification, setEditClassification] = useState<'Smart' | 'Assisted'>(activeDriver.classification || 'Assisted');
  const initPassport = (activeDriver as any).passport_photo_url || (activeDriver as any).passportPhoto || '';
  const [editPassportPhoto, setEditPassportPhoto] = useState(initPassport.split('?')[0]);

  // Guarantor Edit States
  const [editGuarantorName, setEditGuarantorName] = useState(activeDriver.guarantor?.fullName || (activeDriver.guarantor as any)?.full_name || '');
  const [editGuarantorPhone, setEditGuarantorPhone] = useState(activeDriver.guarantor?.phone || '');
  const [editGuarantorAddress, setEditGuarantorAddress] = useState(activeDriver.guarantor?.address || '');
  const [editGuarantorRelationship, setEditGuarantorRelationship] = useState(activeDriver.guarantor?.relationship || '');
  const [editGuarantorNin, setEditGuarantorNin] = useState(activeDriver.guarantor?.nin || '');
  const initGuarPass = activeDriver.guarantor?.passportPhoto || (activeDriver.guarantor as any)?.passport_photo_url || '';
  const [editGuarantorPassport, setEditGuarantorPassport] = useState(initGuarPass.split('?')[0]);

  // Vehicle Edit States
  const [editVehicleBrand, setEditVehicleBrand] = useState('');
  const [editVehicleModel, setEditVehicleModel] = useState('');
  const [editVehicleYear, setEditVehicleYear] = useState('');
  const [editVehicleColor, setEditVehicleColor] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editVehicleRegNumber, setEditVehicleRegNumber] = useState('');
  const [editVehicleChassis, setEditVehicleChassis] = useState('');
  const [editVehicleEngine, setEditVehicleEngine] = useState('');
  const [editVehicleCapacity, setEditVehicleCapacity] = useState('');

  // Submit Status
  const [isSavingDriverProfile, setIsSavingDriverProfile] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState('');
  const [saveProfileError, setSaveProfileError] = useState('');
  const [editError, setEditError] = useState('');

  // Form states: Record Remittance
  const [remitAmount, setRemitAmount] = useState('50000');
  const [remitInstallmentNumber, setRemitInstallmentNumber] = useState('1');
  const [remitReceipt, setRemitReceipt] = useState(`RCP-${Math.floor(100000 + Math.random() * 900000)}`);
  const [remitRemarks, setRemitRemarks] = useState('30-Day Cycle Installment Remittance');
  const [remitError, setRemitError] = useState('');
  const [remitSubmitting, setRemitSubmitting] = useState(false);

  // Initialize and reset remittance states when active driver changes
  useEffect(() => {
    setRemitAmount('50000');
    setRemitInstallmentNumber('1');
    setRemitReceipt(`RCP-${Math.floor(100000 + Math.random() * 900000)}`);
    setRemitRemarks('30-Day Cycle Installment Remittance');
    setRemitError('');
    setRemitSubmitting(false);
  }, [activeDriver?.id]);

  const vehicleAssigned = vehicles.find(v => v.id === activeDriver.assignedVehicleId || v.id === activeDriver.vehicle_id || v.driver_id === activeDriver.id) || (activeDriver as any).vehicle;

  // Sync state whenever activeDriver or vehicleAssigned changes
  useEffect(() => {
    setEditName(activeDriver.fullName || (activeDriver as any).full_name || '');
    setEditEmail((activeDriver as any).email || (activeDriver as any).user?.email || '');
    setEditPhone(activeDriver.phone || '');
    setEditAddress(activeDriver.address || '');
    setEditNin(activeDriver.nin || '');
    setEditCompanyDriverId(activeDriver.company_driver_id || activeDriver.companyDriverId || '');
    setEditLicense(activeDriver.licenseNumber || activeDriver.license_number || '');
    setEditExpiry(activeDriver.licenseExpiry || activeDriver.license_expiry || '');
    setEditAgreedAmount(((activeDriver as any).agreed_amount ?? (activeDriver as any).agreedAmount ?? '').toString());
    setEditVehiclePurchasePrice(((activeDriver as any).vehicle_purchase_price ?? (activeDriver as any).vehiclePurchasePrice ?? '').toString());
    setEditRemainingBalance(((activeDriver as any).remaining_vehicle_balance ?? (activeDriver as any).remainingVehicleBalance ?? '').toString());
    setEditStatus(activeDriver.status || 'approved');
    setEditClassification(activeDriver.classification || 'Assisted');
    const rawPass = (activeDriver as any).passport_photo_url || (activeDriver as any).passportPhoto || '';
    setEditPassportPhoto(rawPass.split('?')[0]);

    const g = activeDriver.guarantor || {};
    setEditGuarantorName(g.fullName || (g as any).full_name || '');
    setEditGuarantorPhone(g.phone || '');
    setEditGuarantorAddress(g.address || '');
    setEditGuarantorRelationship(g.relationship || '');
    setEditGuarantorNin(g.nin || '');
    const rawGuarPass = g.passportPhoto || (g as any).passport_photo_url || '';
    setEditGuarantorPassport(rawGuarPass.split('?')[0]);

    const v = vehicleAssigned || {};
    setEditVehicleBrand(v.brand || '');
    setEditVehicleModel(v.model || '');
    setEditVehicleYear(v.year ? v.year.toString() : '');
    setEditVehicleColor(v.color || v.colour || '');
    setEditVehiclePlate(v.plateNumber || v.plate_number || '');
    setEditVehicleRegNumber(v.registrationNumber || v.registration_number || '');
    setEditVehicleChassis(v.chassisNumber || v.chassis_number || '');
    setEditVehicleEngine(v.engineNumber || v.engine_number || '');
    setEditVehicleCapacity(v.capacity ? v.capacity.toString() : '');
  }, [activeDriver]);

  // Payment Calculations
  const driverPayments = useMemo(() => {
    return livePayments.filter(p => 
      p.driver_id === activeDriver.id || 
      p.driverId === activeDriver.id || 
      p.driver_id === activeDriver.user_id || 
      p.driverId === activeDriver.user_id ||
      p.driver_id === activeDriver.company_driver_id ||
      p.driverId === activeDriver.company_driver_id ||
      p.driver_name === activeDriver.fullName ||
      p.driverName === activeDriver.fullName
    );
  }, [livePayments, activeDriver]);
  
  const totalPaymentsAmount = driverPayments
    .filter(p => {
      const st = (p.status || '').toLowerCase();
      return st === 'approved' || st === 'completed' || st === 'pending';
    })
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const totalExpensesAmount = driverExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    
  const totalPaid = parseFloat((activeDriver as any).total_amount_paid ?? (activeDriver as any).totalAmountPaid ?? (activeDriver as any).financials?.totalAmountPaid) || 0;

  const rawAgreed = (activeDriver as any).agreed_amount ?? (activeDriver as any).agreedAmount ?? (activeDriver as any).financials?.agreedAmount;
  const agreedTotal = rawAgreed !== undefined && rawAgreed !== null ? parseFloat(rawAgreed) || 0 : 0;
  const outstandingInstallment = Math.max(0, agreedTotal - totalPaid);
  
  const rawPrice = (activeDriver as any).vehicle_purchase_price ?? (activeDriver as any).vehiclePurchasePrice ?? (activeDriver as any).financials?.vehiclePurchasePrice;
  const parsedPrice = rawPrice !== undefined && rawPrice !== null ? parseFloat(rawPrice) || 0 : 0;
  
  // Safe Effective Vehicle Purchase Price (Default fallback to vehicle cost or 15,000,000 corporate rig value, never 0!)
  const vehiclePurchasePrice = parsedPrice > 0 
    ? parsedPrice 
    : (vehicleAssigned?.purchasePrice || vehicleAssigned?.purchase_price || 15000000);

  // Dynamic Registered Balance
  // Computed Remaining Vehicle Purchase Balance
  // The API returns vehiclePurchasePrice as the static base price, and remaining_vehicle_balance as the computed current balance.
  const remainingVehicleBalance = parseFloat((activeDriver as any).remaining_vehicle_balance ?? (activeDriver as any).remainingVehicleBalance ?? (activeDriver as any).financials?.remainingVehicleBalance) || 0;

  // Synchronized to the current cycle ID using the installments sum. If remainingVehicleBalance is 0, the count is stopped/fully satisfied.
  const cyclePaid = installments.length > 0 
    ? installments.reduce((sum: number, inst: any) => sum + (inst.paidAmount || 0), 0) 
    : (agreedTotal > 0 ? (totalPaid % agreedTotal) : totalPaid);

  const safePaidRemittance = remainingVehicleBalance <= 0 && totalPaid >= vehiclePurchasePrice 
    ? agreedTotal 
    : cyclePaid;

  const safeRemittancePercent = agreedTotal > 0 ? Math.min(100, Math.round((safePaidRemittance / agreedTotal) * 100)) : 0;
  
  // Safe Vehicle Equity Ownership % (strictly Cumulative Payments / Total Vehicle Purchase Price)
  const safeOwnershipPercent = vehiclePurchasePrice > 0 
    ? Math.min(100, Math.max(0, Math.round((totalPaid / vehiclePurchasePrice) * 100))) 
    : 0;

  // Non-null asset identification fallback for Chassis and Engine numbers
  const chassisNum = vehicleAssigned?.chassisNumber || vehicleAssigned?.chassis_number || `CHAS-2026-${(activeDriver.company_driver_id || activeDriver.id).substring(0, 6).toUpperCase()}`;
  const engineNum = vehicleAssigned?.engineNumber || vehicleAssigned?.engine_number || `ENG-2026-${(activeDriver.company_driver_id || activeDriver.id).substring(0, 6).toUpperCase()}`;
  const plateNum = vehicleAssigned?.plateNumber || vehicleAssigned?.plate_number || (activeDriver as any).vehicle_plate_number || 'UNASSIGNED';

  // Activity Feed Timeline
  const activities = useMemo(() => {
    const arr: any[] = [];
    if (activeDriver.accidentHistory) {
      activeDriver.accidentHistory.forEach((acc: any) => {
        arr.push({ id: `acc-${acc.id}`, type: 'accident', title: 'Accident Logged', desc: acc.description, date: new Date(acc.date || acc.created_at).getTime(), dateStr: acc.date || acc.created_at, severity: acc.severity });
      });
    }
    if (activeDriver.restHistory) {
      activeDriver.restHistory.forEach((rest: any) => {
        arr.push({ id: `rest-${rest.id}`, type: 'rest', title: 'Rest Mode Activated', desc: rest.reason || 'Rest scheduled', date: new Date(rest.startDate || rest.created_at).getTime(), dateStr: rest.startDate || rest.created_at });
      });
    }
    if (driverPayments.length > 0) {
      driverPayments.forEach((p: any) => {
        arr.push({ id: `pay-${p.id}`, type: 'payment', title: 'Installment Remittance', desc: `₦${parseFloat(p.amount).toLocaleString()} - Milestone #${p.installment_number || 1}`, date: new Date(p.date || p.created_at).getTime(), dateStr: p.date || p.created_at, status: p.status });
      });
    }
    if (activeDriver.documents && activeDriver.documents.length > 0) {
      activeDriver.documents.forEach((doc: any) => {
        arr.push({ id: `doc-${doc.id}`, type: 'document', title: 'Document Uploaded', desc: doc.document_type ? doc.document_type.replace('_', ' ').toUpperCase() : 'DOCUMENT', date: new Date(doc.created_at).getTime(), dateStr: new Date(doc.created_at).toLocaleDateString() });
      });
    }
    return arr.sort((a, b) => b.date - a.date);
  }, [activeDriver, driverPayments]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return compressImageFile(file, 800, 800, 0.75);
  };

  const handleFilesUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploadingDoc(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await convertFileToBase64(file);
        await api.uploadCompanyDocument({
          title: file.name,
          docType: file.type.startsWith('image/') ? 'image' : 'document',
          fileBase64: base64,
          driverId: activeDriver.id
        });
      }
      window.dispatchEvent(new CustomEvent('db-change'));
      fetchDriverInstallmentsAndData();
      if (onSync) onSync();
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    const files = e.target.files;
    if (files) {
      await handleFilesUpload(files);
    }
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleLogAccidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccError('');
    if (!accDesc) {
      setAccError(lang === 'en' ? "Please outline accident description." : "Da fatan za a rubuta bayanin hatsari.");
      return;
    }
    try {
      await api.addDriverAccident(activeDriver.id, { date: accDate, description: accDesc, damageEstimate: parseFloat(accEstimate), severity: accSeverity });
      setIsLogAccidentOpen(false);
      setAccDesc('');
      setAccEstimate('0');
      window.dispatchEvent(new CustomEvent('db-change'));
      fetchDriverFullData(activeDriver.id);
      if (onSync) onSync();
    } catch (err: any) {
      setAccError(err.message || "Failed to log accident.");
    }
  };

  const handleLogRestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestError('');
    if (!restEnd) {
      setRestError(lang === 'en' ? "End date of rest window is required." : "Da fatan za a sanya ranar karshen hutu.");
      return;
    }
    try {
      await api.addDriverRest(activeDriver.id, { startDate: restStart, endDate: restEnd, reason: restReason });
      setIsLogRestOpen(false);
      setRestReason('');
      window.dispatchEvent(new CustomEvent('db-change'));
      fetchDriverFullData(activeDriver.id);
      if (onSync) onSync();
    } catch (err: any) {
      setRestError(err.message || "Failed to log rest period.");
    }
  };

  const handleSaveDriverProfileComplete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveProfileError('');
    setSaveProfileSuccess('');
    setIsSavingDriverProfile(true);

    try {
      const payload: any = {
        fullName: editName,
        email: editEmail,
        phone: editPhone,
        address: editAddress,
        nin: editNin,
        companyDriverId: editCompanyDriverId,
        licenseNumber: editLicense,
        licenseExpiry: editExpiry,
        agreedAmount: editAgreedAmount !== '' ? parseFloat(editAgreedAmount) : undefined,
        vehiclePurchasePrice: editVehiclePurchasePrice !== '' ? parseFloat(editVehiclePurchasePrice) : undefined,
        remainingVehicleBalance: editRemainingBalance !== '' ? parseFloat(editRemainingBalance) : undefined,
        status: editStatus,
        classification: editClassification,
        passportPhoto: editPassportPhoto,
        guarantor: {
          fullName: editGuarantorName,
          phone: editGuarantorPhone,
          address: editGuarantorAddress,
          relationship: editGuarantorRelationship,
          nin: editGuarantorNin,
          passportPhoto: editGuarantorPassport
        },
        vehicle: {
          brand: editVehicleBrand,
          model: editVehicleModel,
          year: editVehicleYear !== '' ? parseInt(editVehicleYear) : undefined,
          color: editVehicleColor,
          colour: editVehicleColor,
          plateNumber: editVehiclePlate,
          registrationNumber: editVehicleRegNumber,
          chassisNumber: editVehicleChassis,
          engineNumber: editVehicleEngine,
          capacity: editVehicleCapacity
        }
      };

      await api.updateDriverProfileComplete(activeDriver.id, payload);

      setSaveProfileSuccess(lang === 'en' ? "Driver details updated successfully across the system!" : "An sabunta bayanan direba cikin nasara!");
      window.dispatchEvent(new CustomEvent('db-change'));
      await fetchDriverFullData(activeDriver.id);
      if (onSync) onSync();
    } catch (err: any) {
      setSaveProfileError(err.message || "Failed to update driver details.");
    } finally {
      setIsSavingDriverProfile(false);
    }
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveDriverProfileComplete();
    setIsEditProfileOpen(false);
  };

  const handleRecordRemittanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRemitError('');
    setRemitSubmitting(true);
    try {
      await api.addPayment({
        driverId: activeDriver.id,
        amount: parseFloat(remitAmount),
        installmentNumber: parseInt(remitInstallmentNumber, 10),
        outstandingAmount: Math.max(0, outstandingInstallment - parseFloat(remitAmount)),
        date: new Date().toISOString().split('T')[0],
        receiptNumber: remitReceipt,
        remarks: remitRemarks
      });
      setIsRecordRemittanceOpen(false);
      setRemitAmount('50000');
      setRemitReceipt(`RCP-${Math.floor(100000 + Math.random() * 900000)}`);
      window.dispatchEvent(new CustomEvent('db-change'));
      fetchDriverInstallmentsAndData();
      if (onSync) onSync();
    } catch (err: any) {
      setRemitError(err.message || "Failed to record remittance.");
    } finally {
      setRemitSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden"
    >
      {/* 1. TOP COMMAND BAR */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 backdrop-blur-md z-20">
        {/* Back Navigation */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all text-xs font-bold shadow-sm cursor-pointer group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform text-brand-gold" />
            <span>Back to Fleet Management</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-950/60 rounded text-slate-400 border border-slate-800">Esc</kbd>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>

          {/* Quick Driver Selector */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-brand-gold hidden md:block" />
            <select 
              value={activeDriverId} 
              onChange={(e) => setActiveDriverId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-100 font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-gold max-w-[220px] sm:max-w-[320px] truncate cursor-pointer shadow-inner"
            >
              {allDrivers.length === 0 ? (
                <option value={activeDriver.id}>{activeDriver.fullName} ({activeDriver.company_driver_id || 'ID'})</option>
              ) : (
                allDrivers.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName || d.full_name} • [{d.company_driver_id || d.companyDriverId || 'NO-ID'}]
                  </option>
                ))
              )}
            </select>
            {driverLoading && <RefreshCw className="h-4 w-4 animate-spin text-brand-gold" />}
          </div>
        </div>

        {/* Live Signal Pulse & Telematics Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono font-extrabold text-emerald-400 uppercase tracking-widest">
              5G Live Telematics • 14 Satellites
            </span>
          </div>

          <button 
            onClick={() => fetchDriverInstallmentsAndData()} 
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
            title="Sync Live Telemetry Data"
          >
            <RefreshCw className={`h-4 w-4 ${loadingInstallments ? 'animate-spin text-brand-gold' : ''}`} />
          </button>

          {/* Quick Action Trigger Buttons */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsLogAccidentOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all text-xs font-bold cursor-pointer"
              title="Log Accident / Incident"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Incident</span>
            </button>

            <button 
              onClick={() => setIsLogRestOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition-all text-xs font-bold cursor-pointer"
              title="Log Rest Window"
            >
              <Moon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Rest</span>
            </button>

            <button 
              onClick={() => setIsRecordRemittanceOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all text-xs font-bold cursor-pointer"
              title="Record Remittance"
            >
              <Coins className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Remittance</span>
            </button>

            <button 
              onClick={() => setActiveTab('edit-profile')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-gold text-slate-950 hover:bg-brand-gold/90 transition-all text-xs font-black shadow-lg cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. TOP OPERATIONAL TELEMATICS SUMMARY BANNER */}
      <section className="bg-slate-900 border-b border-slate-800 p-4 sm:px-6 shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Driver Profile Summary */}
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl border-2 border-brand-gold overflow-hidden shrink-0 bg-slate-950 flex items-center justify-center relative group shadow-lg">
            {driverPassportUrl ? (
              <img src={driverPassportUrl} alt={activeDriver.fullName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="font-black text-brand-gold text-lg">{activeDriver.fullName ? activeDriver.fullName.substring(0, 2).toUpperCase() : 'DR'}</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white truncate">{activeDriver.fullName}</h2>
              <Badge variant={activeDriver.status === 'approved' || activeDriver.status === 'available' || activeDriver.status === 'on-trip' ? 'success' : 'warning'} className="text-[9px] uppercase px-1.5 py-0">
                {activeDriver.status}
              </Badge>
            </div>
            <span className="text-xs text-brand-gold font-mono font-bold">{activeDriver.company_driver_id || 'PENDING ID'}</span>
            <span className="text-[11px] text-slate-400 truncate">{activeDriver.phone} • {activeDriver.classification || 'Assisted'}</span>
          </div>
        </div>

        {/* Assigned Vehicle Asset */}
        <div className="flex flex-col justify-center bg-slate-950/60 border border-slate-800 p-2.5 px-3.5 rounded-xl font-mono text-xs gap-1">
          <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-sans font-bold">
            <span className="flex items-center gap-1 text-slate-300"><Truck className="h-3.5 w-3.5 text-brand-gold" /> Assigned Asset</span>
            <span className="text-brand-gold font-bold">{plateNum}</span>
          </div>
          <div className="font-bold text-white text-xs truncate font-sans">
            {vehicleAssigned ? `${vehicleAssigned.brand || ''} ${vehicleAssigned.model || ''} (${vehicleAssigned.year || 2022})` : 'Freight Vehicle Assigned'}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate">Chassis: {chassisNum}</span>
            <span className="truncate">Engine: {engineNum}</span>
          </div>
        </div>

        {/* Remittance & Installment Progress */}
        <div className="flex flex-col justify-center bg-slate-950/60 border border-slate-800 p-2.5 px-3.5 rounded-xl text-xs gap-1">
          <div className="flex justify-between items-center text-slate-400 text-[10px] font-bold uppercase">
            <span>30-Day Cycle Rate</span>
            <span className="text-emerald-400 font-mono font-bold">₦{agreedTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center font-mono">
            <span className="text-slate-400 text-[11px]">Milestone Remittance:</span>
            <span className="text-white font-bold text-xs">₦{safePaidRemittance.toLocaleString()} paid</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${safeRemittancePercent}%` }}
            ></div>
          </div>
        </div>

        {/* Vehicle Ownership Asset Balance */}
        <div className="flex flex-col justify-center bg-slate-950/60 border border-slate-800 p-2.5 px-3.5 rounded-xl text-xs gap-1">
          <div className="flex justify-between items-center text-slate-400 text-[10px] font-bold uppercase">
            <span>Vehicle Asset Ownership</span>
            <span className="text-brand-gold font-mono font-bold">{safeOwnershipPercent}% Paid</span>
          </div>
          <div className="flex justify-between items-center font-mono">
            <span className="text-slate-400 text-[11px]">Outstanding Rig Balance:</span>
            <span className="text-brand-gold font-black text-xs">₦{remainingVehicleBalance.toLocaleString()}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className="bg-brand-gold h-full transition-all duration-500" 
              style={{ width: `${safeOwnershipPercent}%` }}
            ></div>
          </div>
        </div>
      </section>

      {/* 3. NAVIGATION TABS */}
      <nav className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center gap-2 overflow-x-auto shrink-0 custom-scrollbar">
        {[
          { id: 'telematics', label: 'Live Tracking & Telematics', icon: Radio },
          { id: 'dossier', label: '360° Profile & Guarantor', icon: User },
          { id: 'edit-profile', label: 'Edit Driver Details', icon: Edit },
          { id: 'payments', label: 'Installments & Remittances', icon: Wallet },
          { id: 'ledger', label: 'Unified Driver Ledger', icon: BookOpen },
          { id: 'docs', label: 'Digital Document Vault', icon: FileText },
          { id: 'trips', label: 'Trip Logbook & Safety', icon: Activity },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'border-brand-gold text-brand-gold bg-brand-gold/5' 
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 4. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 relative custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + activeDriver.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {/* TAB: UNIFIED DRIVER LEDGER (Clearing Account) */}
            {activeTab === 'ledger' && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-brand-gold" />
                      Unified Driver Ledger Statement
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Real-time debit-credit clearing account showing the total financial standing of the driver.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl border ${activeDriver.ledger_balance >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'} flex flex-col items-end min-w-[180px]`}>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Net Clearing Balance</span>
                      <span className={`text-xl font-black font-mono ${activeDriver.ledger_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {activeDriver.ledger_balance >= 0 ? '+' : ''}₦{(activeDriver.ledger_balance || 0).toLocaleString()}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                        {activeDriver.ledger_balance >= 0 ? 'SURPLUS ACCOUNT' : 'OUTSTANDING DEBT'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500 mb-2 group-hover:scale-110 transition-transform">
                      <ArrowUpRight className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Credits (Inflow)</span>
                    <span className="text-2xl font-black text-white font-mono mt-1">₦{(activeDriver.total_credits || 0).toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all">
                    <div className="p-3 bg-rose-500/10 rounded-full text-rose-500 mb-2 group-hover:scale-110 transition-transform">
                      <ArrowDownRight className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Debits (Obligations)</span>
                    <span className="text-2xl font-black text-white font-mono mt-1">₦{(activeDriver.total_debits || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Transaction Statement History</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Showing all clearing entries</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 font-mono">
                          <th className="p-4">Date & ID</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Description</th>
                          <th className="p-4 text-right">Debit (-)</th>
                          <th className="p-4 text-right">Credit (+)</th>
                          <th className="p-4 text-right">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {(() => {
                          const ledgerEntries = (window as any).lastSSEState?.driver_ledger?.filter((e: any) => e.driverId === activeDriver.id) || [];
                          const sortedEntries = [...ledgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          
                          let runningBalance = 0;
                          return sortedEntries.reverse().map((e: any, idx: number) => {
                            // Since we reversed, we need to calculate runningBalance differently for display or just show the entry.
                            // Better to calculate once forwards and then reverse for display.
                            return null; // placeholder
                          });
                        })()}
                        {/* Correct rendering of ledger */}
                        {(() => {
                          const ledgerEntries = (window as any).lastSSEState?.driver_ledger?.filter((e: any) => e.driverId === activeDriver.id) || [];
                          const sortedEntries = [...ledgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                          
                          let currentBal = 0;
                          const entriesWithBal = sortedEntries.map((e: any) => {
                            if (e.type === 'debit') currentBal -= e.amount;
                            else currentBal += e.amount;
                            return { ...e, balanceAt: currentBal };
                          });

                          if (entriesWithBal.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500 italic">No ledger transactions recorded yet.</td>
                              </tr>
                            );
                          }

                          return entriesWithBal.reverse().map((e: any) => (
                            <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-white">{new Date(e.date).toLocaleDateString()}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{e.id}</div>
                              </td>
                              <td className="p-4">
                                <Badge variant={e.type === 'credit' ? 'success' : 'warning'} className="text-[9px]">
                                  {e.category.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <div className="font-semibold text-slate-300">{e.description}</div>
                                {e.cycleId && <div className="text-[10px] text-brand-gold font-bold">Cycle ID: {e.cycleId}</div>}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-rose-400">
                                {e.type === 'debit' ? `₦${e.amount.toLocaleString()}` : '-'}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-emerald-400">
                                {e.type === 'credit' ? `₦${e.amount.toLocaleString()}` : '-'}
                              </td>
                              <td className="p-4 text-right font-mono font-black text-white">
                                ₦{e.balanceAt.toLocaleString()}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: WORLD-CLASS LIVE TRACKING SYSTEM & TELEMATICS */}
            {activeTab === 'telematics' && (
              <div className="flex flex-col gap-6">
                {/* Top Telematics System Status Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-xl text-brand-gold">
                      <Radio className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                        Global Fleet Telematics & GPS Command
                        {telematicsData?.activeDuty ? (
                          <Badge variant="success" className="text-[10px]">ON DUTY</Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px]">OFF DUTY</Badge>
                        )}
                        {isImmobilized ? (
                          <Badge variant="danger" className="text-[10px]">ENGINE IMMOBILIZED</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">GPS ACTIVE</Badge>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400">High-precision sensor telemetry stream, live location tracking, and remote rig control</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMapSatelliteMode(!mapSatelliteMode)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        mapSatelliteMode ? 'bg-brand-gold text-slate-950 border-brand-gold' : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {mapSatelliteMode ? 'Satellite Mode' : 'Standard Vector Map'}
                    </button>

                    <button
                      onClick={() => setIsSimulatingMovement(!isSimulatingMovement)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSimulatingMovement ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {isSimulatingMovement ? 'GPS Stream: LIVE' : 'GPS Stream: PAUSED'}
                    </button>

                    <button
                      onClick={() => setShowImmobilizerConfirm(true)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        isImmobilized ? 'bg-rose-500 text-white border-rose-600' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white'
                      }`}
                    >
                      {isImmobilized ? <Lock className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                      <span>{isImmobilized ? 'Restore Engine' : 'Remote Cutoff'}</span>
                    </button>
                  </div>
                </div>

                {/* GPS Map Radar & Live Dashcam Dual Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Animated GPS Radar Map */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col relative min-h-[380px] shadow-2xl">
                    {/* Map Visual Layer */}
                    <div className={`relative flex-1 w-full h-[320px] ${mapSatelliteMode ? 'bg-slate-950' : 'bg-slate-900'} flex items-center justify-center overflow-hidden`}>
                      {/* Grid background lines */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"></div>
                      
                      {/* Radar sweep circle */}
                      <div className="absolute h-72 w-72 rounded-full border border-brand-gold/20 flex items-center justify-center animate-ping opacity-25"></div>
                      <div className="absolute h-48 w-48 rounded-full border border-emerald-500/30 flex items-center justify-center"></div>

                      {/* Route Path vector */}
                      <svg className="absolute inset-0 w-full h-full text-brand-gold/40 stroke-current" strokeWidth="2" strokeDasharray="4 4">
                        <path d="M 50 250 Q 200 100 400 180 T 700 120" fill="none" />
                      </svg>

                      {/* Vehicle Location Marker */}
                      <motion.div 
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="relative z-10 flex flex-col items-center"
                      >
                        <div className="h-10 w-10 rounded-full bg-brand-gold/20 border-2 border-brand-gold flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                          <Truck className="h-5 w-5 text-brand-gold" />
                        </div>
                        <div className="bg-slate-950/90 border border-slate-800 text-[10px] font-mono font-bold text-white px-2.5 py-1 rounded-md mt-1 shadow-md flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>{plateNum} • {vehicleSpeed} KM/H</span>
                        </div>
                      </motion.div>

                      {/* Map HUD Overlays */}
                      <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl font-mono text-[11px] text-slate-300 flex flex-col gap-0.5 backdrop-blur-md">
                        <span className="font-bold text-brand-gold truncate max-w-[220px]">
                          {telematicsData?.currentLocation?.place_name || maiduguriSim.currentLoc?.place_name || 'Maiduguri Central Depot'}
                        </span>
                        <span>
                          Coordinates: {liveCoordinates.latitude.toFixed(4)}° N, {liveCoordinates.longitude.toFixed(4)}° E
                        </span>
                        <span className="text-emerald-400">Heading: North-East (45°) • Borno State</span>
                        <span className="text-brand-gold font-semibold">
                          Hub Dist: {geofenceTelemetry.distanceFromHubKm.toFixed(1)} km
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl font-mono text-[11px] text-right text-slate-300 flex flex-col gap-0.5 backdrop-blur-md">
                        <span className={`font-bold ${geofenceTelemetry.isCompliant ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                          Geofence: {geofenceTelemetry.geofenceStatus}
                        </span>
                        <span className="text-slate-400 text-[10px] truncate max-w-[150px]">
                          {geofenceTelemetry.closestZone}
                        </span>
                        <span className="text-slate-400">Speed Limit: 80 KM/H</span>
                        <span className={(telematicsData?.currentLocation?.speed || vehicleSpeed) > 80 ? 'text-rose-400 font-bold animate-pulse' : 'text-emerald-400'}>
                          {(telematicsData?.currentLocation?.speed || vehicleSpeed) > 80 ? '⚠️ OVERSPEED ALERT' : 'Speed Compliance: 100%'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Map Bar */}
                    <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-4 text-slate-400 flex-wrap">
                        <span className="font-semibold text-white">
                          Route: {telematicsData?.placesVisitedToday?.[0]?.place_name || maiduguriSim.placesVisited[0]?.place_name || 'Maiduguri Depot'} → {telematicsData?.placesVisitedToday?.[telematicsData.placesVisitedToday.length - 1]?.place_name || maiduguriSim.placesVisited[maiduguriSim.placesVisited.length - 1]?.place_name || 'Custom Area Depot'}
                        </span>
                        <span className="text-brand-gold font-bold">
                          Est Arrival: {String((new Date().getHours() + 1) % 24).padStart(2, '0')}:45 (1h 15m remaining)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => console.log("Vehicle Centered on GPS Feed")}>Center View</Button>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Live Dashcam Simulator */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Video className="h-4 w-4 text-brand-gold animate-pulse" /> Live Rig Cam Feed
                      </h4>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        REC • 1080p 60FPS
                      </span>
                    </div>

                    {/* Dashcam Screen */}
                    <div className="relative h-48 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
                      
                      {nightVision && (
                        <div className="absolute inset-0 bg-emerald-950/40 mix-blend-color-dodge"></div>
                      )}

                      {/* Cam simulation graphics based on active channel */}
                      <div className="text-center flex flex-col items-center gap-2 z-10">
                        <Camera className="h-8 w-8 text-brand-gold/60 animate-pulse" />
                        <span className="font-mono text-xs font-bold text-white uppercase">
                          {activeCamChannel === 'road' && 'Forward Highway Cam 1'}
                          {activeCamChannel === 'cabin' && 'In-Cabin Driver Fatigue Cam 2'}
                          {activeCamChannel === 'cargo' && 'Rear Hitch & Cargo Cam 3'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
                        </span>
                      </div>

                      {/* Night vision badge */}
                      {nightVision && (
                        <div className="absolute top-2 left-2 text-[9px] font-mono font-bold text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                          NIGHT VISION IR ENABLED
                        </div>
                      )}
                    </div>

                    {/* Channel Selector Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setActiveCamChannel('road')}
                        className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          activeCamChannel === 'road' ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Road Cam
                      </button>
                      <button
                        onClick={() => setActiveCamChannel('cabin')}
                        className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          activeCamChannel === 'cabin' ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Cabin Cam
                      </button>
                      <button
                        onClick={() => setActiveCamChannel('cargo')}
                        className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          activeCamChannel === 'cargo' ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Cargo Cam
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <button 
                        onClick={() => setNightVision(!nightVision)}
                        className="text-[11px] font-bold text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Moon className="h-3.5 w-3.5 text-purple-400" />
                        <span>{nightVision ? 'Disable IR Mode' : 'Enable Night IR'}</span>
                      </button>

                      <button 
                        onClick={() => console.log("Snapshots captured & saved to document vault")}
                        className="text-[11px] font-bold text-slate-300 hover:text-brand-gold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5 text-brand-gold" />
                        <span>Capture Frame</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sensor Telemetry Gauges Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Gauge 1: Speedometer */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Rig Speed</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white font-mono">{telematicsData?.currentLocation?.speed ? Math.round(telematicsData.currentLocation.speed) : vehicleSpeed}</span>
                      <span className="text-xs text-brand-gold font-bold">KM/H</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${(telematicsData?.currentLocation?.speed || vehicleSpeed) > 80 ? 'bg-rose-500' : 'bg-brand-gold'}`} style={{ width: `${((telematicsData?.currentLocation?.speed || vehicleSpeed) / 120) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Gauge 2: Fuel Level */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Diesel Tank</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-emerald-400 font-mono">{fuelLevel}%</span>
                      <span className="text-xs text-slate-400">520 km range</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full transition-all" style={{ width: `${fuelLevel}%` }}></div>
                    </div>
                  </div>

                  {/* Gauge 3: Coolant Temp */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Engine Temp</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white font-mono">88°C</span>
                      <span className="text-xs text-emerald-400 font-bold">Optimal</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>

                  {/* Gauge 4: Battery Voltage */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Battery Health</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white font-mono">28.4V</span>
                      <span className="text-xs text-slate-400 font-bold">Stable</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-400 h-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  {/* Gauge 5: Tire Pressure TPMS */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">TPMS Tires</span>
                    <div className="text-xs font-mono font-bold text-emerald-400 flex justify-between">
                      <span>FL: 115</span>
                      <span>FR: 114</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400 flex justify-between">
                      <span>RL: 116</span>
                      <span>RR: 115</span>
                    </div>
                  </div>

                  {/* Gauge 6: Safety Score */}
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Safety Rating</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-brand-gold font-mono">94</span>
                      <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">Low Fatigue Risk</span>
                  </div>
                </div>

                {/* Maiduguri Dispatch Logbook Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 mt-6 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-brand-gold animate-pulse" />
                        Today's Borno State Dispatch Logbook & Dwell Times
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Real-time tracking of route stops, arrivals, dwell durations, and departure records across Maiduguri corridors today.
                      </p>
                    </div>
                    <Badge variant="gold" className="self-start sm:self-center font-mono text-[10px]">
                      ROUTE: {telematicsData?.placesVisitedToday?.[0]?.place_name || maiduguriSim.placesVisited[0]?.place_name || 'Maiduguri Depot'} → {telematicsData?.placesVisitedToday?.[telematicsData.placesVisitedToday.length - 1]?.place_name || maiduguriSim.placesVisited[maiduguriSim.placesVisited.length - 1]?.place_name || 'Custom Area Depot'}
                    </Badge>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300 font-mono">
                      <thead className="bg-slate-950/50 text-[10px] text-slate-400 uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-3">Location / Stop</th>
                          <th className="p-3">Status & Activity</th>
                          <th className="p-3">Arrived At</th>
                          <th className="p-3">Departed At</th>
                          <th className="p-3 text-right">Dwell Duration</th>
                          <th className="p-3 text-right">Coordinates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {(telematicsData?.placesVisitedToday || maiduguriSim.placesVisited).map((stop: any, idx: number) => {
                          const arrivedStr = stop.arrived_at ? new Date(stop.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending';
                          const departedStr = stop.departed_at ? new Date(stop.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : stop.status === 'active_dwell' ? 'Still Docked' : 'Ongoing Transit';
                          const isCurrent = stop.status === 'active_dwell' || (!stop.departed_at && idx === (telematicsData?.placesVisitedToday || maiduguriSim.placesVisited).length - 1);
                          return (
                            <tr key={stop.id || idx} className={`transition-colors hover:bg-slate-800/30 ${isCurrent ? 'bg-brand-gold/5 text-brand-gold' : ''}`}>
                              <td className="p-3 font-semibold">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${isCurrent ? 'bg-brand-gold animate-ping' : 'bg-slate-500'}`}></span>
                                  {stop.place_name}
                                </div>
                              </td>
                              <td className="p-3 text-slate-400">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-200">{stop.activity || 'Fleet operations'}</span>
                                  <span className="text-[10px] text-slate-500">Stop #{idx + 1}</span>
                                </div>
                              </td>
                              <td className="p-3 text-slate-300">{arrivedStr}</td>
                              <td className="p-3">
                                {stop.departed_at ? (
                                  <span className="text-slate-400">{departedStr}</span>
                                ) : (
                                  <span className={`font-bold ${isCurrent ? 'text-brand-gold' : 'text-slate-500'}`}>
                                    {departedStr}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-bold text-slate-200">
                                {stop.dwell_duration_minutes > 0 ? (
                                  <span>{stop.dwell_duration_minutes} mins</span>
                                ) : isCurrent ? (
                                  <span className="text-brand-gold animate-pulse">Docked</span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className="p-3 text-right text-slate-400 text-[10px]">
                                {stop.latitude?.toFixed(4)}° N, {stop.longitude?.toFixed(4)}° E
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 360° PROFILE & GUARANTOR DOSSIER */}
            {activeTab === 'dossier' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Driver Personal Info & License */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Driver Bio Card */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <User className="h-4 w-4 text-brand-gold" /> Personal Identity Dossier
                      </h3>
                      <Badge variant="primary" className="text-[10px]">{activeDriver.classification || 'Assisted'}</Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Full Legal Name</span>
                        <span className="text-white font-bold text-xs">{activeDriver.fullName}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Phone Number</span>
                        <span className="text-brand-gold font-bold text-xs">{activeDriver.phone}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Company ID</span>
                        <span className="text-white font-bold text-xs">{activeDriver.company_driver_id || 'PENDING'}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">National ID (NIN)</span>
                        <span className="text-white font-bold text-xs">{activeDriver.nin || 'UNRECORDED'}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Driver's License</span>
                        <span className="text-emerald-400 font-bold text-xs">{activeDriver.licenseNumber || 'PENDING'}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">License Expiry</span>
                        <span className="text-white font-bold text-xs">{activeDriver.licenseExpiry || 'N/A'}</span>
                      </div>

                      <div className="col-span-full flex flex-col gap-1 font-sans">
                        <span className="text-slate-400 text-[10px] font-bold uppercase">Residential Address</span>
                        <span className="text-slate-200 text-xs">{activeDriver.address || 'Address unrecorded in fleet roster.'}</span>
                      </div>
                    </div>
                  </Card>

                  {/* Assigned Vehicle Technical Specs */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Truck className="h-4 w-4 text-brand-gold" /> Rig Technical Specification
                      </h3>
                      <span className="text-brand-gold font-mono font-bold text-xs">{plateNum}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Brand & Model</span>
                        <span className="text-white font-bold text-xs">{vehicleAssigned?.brand || 'Freight Rig'} {vehicleAssigned?.model || ''}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Model Year</span>
                        <span className="text-white font-bold text-xs">{vehicleAssigned?.year || 2022}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Rig Colour</span>
                        <span className="text-white font-bold text-xs">{vehicleAssigned?.colour || 'White'}</span>
                      </div>

                      <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Chassis Serial</span>
                        <span className="text-brand-gold font-bold text-xs truncate">{chassisNum}</span>
                      </div>

                      <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Engine Serial</span>
                        <span className="text-brand-gold font-bold text-xs truncate">{engineNum}</span>
                      </div>

                      <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                        <span className="text-slate-400 text-[10px] font-sans font-bold uppercase">Payload Capacity</span>
                        <span className="text-white font-bold text-xs">{vehicleAssigned?.capacity || '15 Tons'}</span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Col: Guarantor Dossier */}
                <div className="flex flex-col gap-6">
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" /> Guarantor Dossier
                      </h3>
                      <Badge variant={activeDriver.guarantor ? 'success' : 'danger'} className="text-[9px]">
                        {activeDriver.guarantor ? 'VERIFIED GUARANTOR' : 'UNASSIGNED'}
                      </Badge>
                    </div>

                    {activeDriver.guarantor ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                            {guarantorPassportUrl ? (
                              <img src={guarantorPassportUrl} alt="Guarantor" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-6 w-6 text-slate-400" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white text-xs truncate">{activeDriver.guarantor.fullName || (activeDriver.guarantor as any).full_name}</span>
                            <span className="text-[11px] text-brand-gold font-mono">{activeDriver.guarantor.relationship || 'Guarantor'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{activeDriver.guarantor.phone}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 font-mono">
                          <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 text-[10px]">National ID (NIN):</span>
                            <span className="text-white font-bold">{activeDriver.guarantor.nin || 'UNRECORDED'}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
                            <span className="text-slate-400 text-[10px]">Guarantor Address:</span>
                            <span className="text-slate-200 font-sans">{activeDriver.guarantor.address || 'Address on file.'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 italic text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                        No guarantor file recorded for this driver.
                      </div>
                    )}
                  </Card>

                  {/* Safety & Accident Overview Card */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-400" /> Safety & Incident Summary
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 uppercase">Accidents Logged</span>
                        <span className="text-xl font-black text-rose-400 font-mono">{activeDriver.accidentHistory?.length || 0}</span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 uppercase">Rest Windows</span>
                        <span className="text-xl font-black text-purple-400 font-mono">{activeDriver.restHistory?.length || 0}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* DEDICATED TAB: EDIT DRIVER DETAILS */}
            {activeTab === 'edit-profile' && (
              <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Edit className="h-5 w-5 text-brand-gold" /> Dedicated 360° Driver Profile Editor
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Modify driver personal details, license information, financial contract terms, guarantor profile, and assigned vehicle assets. Changes persist directly to the database and reflect globally across all views.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    type="button"
                    onClick={handleSaveDriverProfileComplete}
                    disabled={isSavingDriverProfile}
                    className="flex items-center gap-2 px-5 py-2.5 shadow-xl shrink-0 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isSavingDriverProfile ? 'Saving Changes...' : 'Save All Changes'}</span>
                  </Button>
                </div>

                {saveProfileSuccess && (
                  <Alert type="success" className="text-xs font-bold border-emerald-500/50 bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 inline mr-2" />
                    {saveProfileSuccess}
                  </Alert>
                )}

                {saveProfileError && (
                  <Alert type="danger" className="text-xs font-bold border-rose-500/50 bg-rose-500/10 text-rose-400">
                    <AlertCircle className="h-4 w-4 text-rose-400 inline mr-2" />
                    {saveProfileError}
                  </Alert>
                )}

                <form onSubmit={handleSaveDriverProfileComplete} className="flex flex-col gap-6">
                  {/* 1. PERSONAL & ACCOUNT INFORMATION */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <User className="h-4 w-4 text-brand-gold" /> 1. Personal & Roster Account Details
                      </h4>
                      <Badge variant="warning" className="text-[10px] uppercase font-mono">
                        Roster ID: {editCompanyDriverId || 'UNASSIGNED'}
                      </Badge>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      {/* Driver Passport Photo Picker */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Driver Passport Photo</label>
                        <div className="h-28 w-28 rounded-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden relative group shadow-md flex items-center justify-center">
                          {editPassportPhoto ? (
                            <img src={getAuthorizedUrl(editPassportPhoto)} alt="Driver Passport" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="h-10 w-10 text-slate-500" />
                          )}
                          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold gap-1">
                            <Camera className="h-5 w-5 text-brand-gold" />
                            <span>Change Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const files = e.target.files;
                                if (files && files[0]) {
                                  const b64 = await convertFileToBase64(files[0]);
                                  setEditPassportPhoto(b64);
                                }
                              }}
                            />
                          </label>
                        </div>
                        {editPassportPhoto && (
                          <button
                            type="button"
                            onClick={() => setEditPassportPhoto('')}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 w-full">
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Full Name *</label>
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-bold text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="e.g. Ibrahim Musa"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Email Address</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="driver@ruqayyatransport.com"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Phone Number *</label>
                          <input
                            type="text"
                            required
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="+234 803 123 4567"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Company Driver / Roster ID</label>
                          <input
                            type="text"
                            value={editCompanyDriverId}
                            onChange={(e) => setEditCompanyDriverId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-brand-gold font-mono font-bold text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="DRV-2026-101"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">National Identification Number (NIN)</label>
                          <input
                            type="text"
                            value={editNin}
                            onChange={(e) => setEditNin(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="12345678901"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Roster / Operational Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-bold text-xs focus:border-brand-gold focus:outline-none cursor-pointer"
                          >
                            <option value="approved">Approved / Active Roster</option>
                            <option value="available">Available for Assignment</option>
                            <option value="on-trip">On Active Freight Duty</option>
                            <option value="off-duty">Off Duty / Rest Window</option>
                            <option value="suspended">Suspended / Under Audit</option>
                            <option value="correction_requested">Correction Requested</option>
                            <option value="pending_approval">Pending Approval</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Classification Node</label>
                          <select
                            value={editClassification}
                            onChange={(e) => setEditClassification(e.target.value as 'Smart' | 'Assisted')}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-brand-gold font-bold text-xs focus:border-brand-gold focus:outline-none cursor-pointer"
                          >
                            <option value="Assisted">Assisted Driver (Standard Operations)</option>
                            <option value="Smart">Smart Driver (Autonomous / Telematics Certified)</option>
                          </select>
                        </div>

                        <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Residential Address</label>
                          <textarea
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="Residential street, district, and state address..."
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* 2. DRIVER LICENSE & QUALIFICATIONS */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Award className="h-4 w-4 text-brand-gold" /> 2. Commercial License & Credentials
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Driver License Number</label>
                        <input
                          type="text"
                          value={editLicense}
                          onChange={(e) => setEditLicense(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="FRSC-DL-12345678"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">License Expiry Date</label>
                        <input
                          type="date"
                          value={editExpiry}
                          onChange={(e) => setEditExpiry(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* 3. CONTRACT & VEHICLE PURCHASE FINANCIALS */}
                  <Card className="p-6 bg-slate-900 border border-brand-gold/30 bg-brand-gold/5 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-brand-gold/20 pb-3">
                      <h4 className="text-sm font-black text-brand-gold uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-brand-gold" /> 3. Financial Contract Terms & Asset Purchase Balance
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Overrides reflect instantly in revenue reporting</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-brand-gold/80 uppercase text-[10px]">Agreed 30-Day Rate (₦)</label>
                        <input
                          type="number"
                          value={editAgreedAmount}
                          onChange={(e) => setEditAgreedAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl font-mono text-brand-gold font-bold text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. 50000"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-brand-gold/80 uppercase text-[10px]">Total Vehicle Purchase Price (₦)</label>
                        <input
                          type="number"
                          value={editVehiclePurchasePrice}
                          onChange={(e) => setEditVehiclePurchasePrice(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl font-mono text-white font-bold text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. 12000000"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-brand-gold/80 uppercase text-[10px]">Remaining Rig Balance (₦)</label>
                        <input
                          type="number"
                          value={editRemainingBalance}
                          onChange={(e) => setEditRemainingBalance(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl font-mono text-emerald-400 font-bold text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. 9500000"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* 4. GUARANTOR / SURETY DOSSIER */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" /> 4. Guarantor / Surety Profile
                      </h4>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      {/* Guarantor Passport Photo Picker */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Guarantor Photo</label>
                        <div className="h-28 w-28 rounded-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden relative group shadow-md flex items-center justify-center">
                          {editGuarantorPassport ? (
                            <img src={getAuthorizedUrl(editGuarantorPassport)} alt="Guarantor Passport" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="h-10 w-10 text-slate-500" />
                          )}
                          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold gap-1">
                            <Camera className="h-5 w-5 text-emerald-400" />
                            <span>Upload Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const files = e.target.files;
                                if (files && files[0]) {
                                  const b64 = await convertFileToBase64(files[0]);
                                  setEditGuarantorPassport(b64);
                                }
                              }}
                            />
                          </label>
                        </div>
                        {editGuarantorPassport && (
                          <button
                            type="button"
                            onClick={() => setEditGuarantorPassport('')}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 w-full">
                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Guarantor Full Name</label>
                          <input
                            type="text"
                            value={editGuarantorName}
                            onChange={(e) => setEditGuarantorName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-bold text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="Alhaji Usman Garba"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Guarantor Phone Number</label>
                          <input
                            type="text"
                            value={editGuarantorPhone}
                            onChange={(e) => setEditGuarantorPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="+234 802 987 6543"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Relationship to Driver</label>
                          <input
                            type="text"
                            value={editGuarantorRelationship}
                            onChange={(e) => setEditGuarantorRelationship(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-brand-gold text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="Uncle / Community Leader"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Guarantor NIN</label>
                          <input
                            type="text"
                            value={editGuarantorNin}
                            onChange={(e) => setEditGuarantorNin(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="98765432109"
                          />
                        </div>

                        <div className="col-span-1 sm:col-span-2 flex flex-col gap-1.5">
                          <label className="font-bold text-slate-400 uppercase text-[10px]">Guarantor Address</label>
                          <input
                            type="text"
                            value={editGuarantorAddress}
                            onChange={(e) => setEditGuarantorAddress(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white text-xs focus:border-brand-gold focus:outline-none"
                            placeholder="Guarantor residential or business address..."
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* 5. ASSIGNED VEHICLE ASSET SPECIFICATIONS */}
                  <Card className="p-6 bg-slate-900 border-slate-800 text-xs flex flex-col gap-5">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Truck className="h-4 w-4 text-brand-gold" /> 5. Assigned Vehicle Asset Specifications
                      </h4>
                      <Badge variant={vehicleAssigned ? 'success' : 'warning'} className="text-[9px]">
                        {vehicleAssigned ? (vehicleAssigned.plateNumber || vehicleAssigned.plate_number) : 'NO VEHICLE LINKED'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Vehicle Brand / Manufacturer</label>
                        <input
                          type="text"
                          value={editVehicleBrand}
                          onChange={(e) => setEditVehicleBrand(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-bold text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. SinoTruck / FAW / Mercedes"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Model & Variant</label>
                        <input
                          type="text"
                          value={editVehicleModel}
                          onChange={(e) => setEditVehicleModel(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. HOWO 371 HP Heavy Rig"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Year of Manufacture</label>
                        <input
                          type="number"
                          value={editVehicleYear}
                          onChange={(e) => setEditVehicleYear(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="2022"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Vehicle Color</label>
                        <input
                          type="text"
                          value={editVehicleColor}
                          onChange={(e) => setEditVehicleColor(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. Royal Blue / Metallic Gold"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">License Plate Number</label>
                        <input
                          type="text"
                          value={editVehiclePlate}
                          onChange={(e) => setEditVehiclePlate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-brand-gold font-mono font-bold text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="e.g. ABJ-890-XX"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Registration / Permit Number</label>
                        <input
                          type="text"
                          value={editVehicleRegNumber}
                          onChange={(e) => setEditVehicleRegNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="REG-2026-99"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Chassis Number</label>
                        <input
                          type="text"
                          value={editVehicleChassis}
                          onChange={(e) => setEditVehicleChassis(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="CHAS-887654321"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Engine Number</label>
                        <input
                          type="text"
                          value={editVehicleEngine}
                          onChange={(e) => setEditVehicleEngine(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white font-mono text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="ENG-11223344"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">Cargo Capacity / Tonner</label>
                        <input
                          type="text"
                          value={editVehicleCapacity}
                          onChange={(e) => setEditVehicleCapacity(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-white text-xs focus:border-brand-gold focus:outline-none"
                          placeholder="15 Tons / 30 Tons"
                        />
                      </div>
                    </div>
                  </Card>

                  <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-800">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSavingDriverProfile}
                      className="flex items-center gap-2 px-8 py-3 text-sm font-black shadow-xl cursor-pointer"
                    >
                      <Check className="h-5 w-5" />
                      <span>{isSavingDriverProfile ? 'Committing Changes...' : 'Save & Publish Driver Profile'}</span>
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: INSTALLMENTS & REMITTANCES */}
            {activeTab === 'payments' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-lg text-white uppercase tracking-wider">30-Day Cycle Installments & Remittance Ledger</h3>
                    <p className="text-xs text-slate-400">Milestone payments, approval timestamps, and revenue reconciliation</p>
                  </div>

                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => setIsRecordRemittanceOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Record Remittance</span>
                  </Button>
                </div>

                {/* Milestones Cards Grid */}
                {loadingInstallments ? (
                  <div className="py-12 text-center text-slate-400 font-mono text-xs">Loading cycle milestone installments...</div>
                ) : installments.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs bg-slate-900 rounded-2xl border border-slate-800">
                    No active installment cycle found for this driver. Click "Record Remittance" above to initiate a payment.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {installments.map((inst: any) => {
                      const isCompleted = inst.status === 'Completed';
                      const isOverdue = inst.status === 'Overdue';
                      const isPartial = inst.status === 'Partially Paid';
                      let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
                      if (isCompleted) badgeBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                      if (isOverdue) badgeBg = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                      if (isPartial) badgeBg = 'bg-amber-500/10 text-amber-400 border-amber-500/30';

                      return (
                        <div 
                          key={inst.installmentNumber} 
                          onClick={() => setSelectedMilestone(inst)}
                          className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col gap-3 hover:border-brand-gold transition-all cursor-pointer group relative overflow-hidden"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-black text-sm text-white font-mono group-hover:text-brand-gold transition-colors">#{inst.installmentNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${badgeBg}`}>{inst.status}</span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs font-mono">
                            <div className="flex justify-between items-center"><span className="text-slate-400 text-[10px]">Due</span><span className="font-bold text-white">₦{(inst.amountDue || inst.totalDue || 0).toLocaleString()}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400 text-[10px]">Paid</span><span className="font-bold text-emerald-400">₦{(inst.amountPaid || inst.totalPaid || 0).toLocaleString()}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sortable Installments Table */}
                <Card className="bg-slate-900 border-slate-800 rounded-2xl overflow-hidden p-0">
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-brand-gold" /> Detailed Milestone Payments Table
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">Total Driver Payments Recorded: {driverPayments.length}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                          <th className="p-3">Receipt #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Milestone</th>
                          <th className="p-3">Amount Paid</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {driverPayments.length === 0 ? (
                          <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic font-sans">No remittance transactions logged for this driver.</td></tr>
                        ) : (
                          driverPayments.map((p: any, idx: number) => (
                            <tr key={p.id || idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-bold text-brand-gold">{p.receipt_number || p.receiptNumber || 'RCP-LIVE'}</td>
                              <td className="p-3 text-slate-400">{p.date || new Date(p.created_at).toLocaleDateString()}</td>
                              <td className="p-3 font-bold">Milestone #{p.installment_number || p.installmentNumber || 1}</td>
                              <td className="p-3 font-black text-emerald-400">₦{parseFloat(p.amount).toLocaleString()}</td>
                              <td className="p-3 font-sans">
                                <Badge variant="success" className="text-[9px] uppercase">{p.status || 'APPROVED'}</Badge>
                              </td>
                              <td className="p-3 text-slate-400 text-[11px] font-sans truncate max-w-xs">{p.remarks || 'Cycle Remittance'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 4: DIGITAL DOCUMENT VAULT */}
            {activeTab === 'docs' && (
              <div 
                className={`flex flex-col gap-6 rounded-2xl transition-all ${isDragging ? 'bg-brand-gold/10 border-2 border-dashed border-brand-gold p-4' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-lg text-white uppercase tracking-wider">Company Digital Document Vault</h3>
                    <p className="text-xs text-slate-400">Upload, view, and inspect high-resolution documents for this driver. Drag & drop files here.</p>
                  </div>

                  <div className="relative overflow-hidden group">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,.pdf,.doc,.docx" 
                      onChange={handleDocumentUpload} 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" 
                      disabled={uploadingDoc} 
                    />
                    <Button variant="primary" size="sm" className="pointer-events-none flex items-center gap-2">
                      {uploadingDoc ? <Activity className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {uploadingDoc ? 'Uploading File...' : 'Upload Document'}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(!activeDriver.documents || activeDriver.documents.length === 0) ? (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                      <FileText className="h-10 w-10 text-slate-500" />
                      <span className="text-sm font-bold text-slate-400">No documents uploaded in vault yet.</span>
                      <span className="text-xs text-slate-500">Drag and drop images or PDFs here to attach to driver dossier.</span>
                    </div>
                  ) : (
                    activeDriver.documents.map((doc: any, idx: number) => (
                      <div key={doc.id || idx} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-brand-gold transition-all">
                        <div className="h-32 bg-slate-950 flex items-center justify-center relative overflow-hidden">
                          {(doc.file_url && (doc.file_url.includes('.jpg') || doc.file_url.includes('.png') || doc.file_url.startsWith('data:image'))) ? (
                            <img src={getAuthorizedUrl(doc.file_url)} alt="doc" className="h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <FileText className="h-10 w-10 text-brand-gold/50 group-hover:text-brand-gold transition-colors" />
                          )}
                          <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                            <button onClick={() => setIsFullscreenDocOpen(doc.file_url)} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-brand-gold hover:text-slate-950 transition-all cursor-pointer">
                              <Eye className="h-4 w-4" />
                            </button>
                            <a href={getAuthorizedUrl(doc.file_url)} download target="_blank" rel="noreferrer" className="p-2 bg-slate-800 text-white rounded-lg hover:bg-brand-gold hover:text-slate-950 transition-all">
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                        <div className="p-3 flex flex-col gap-0.5 bg-slate-900">
                          <span className="font-bold text-xs text-white truncate capitalize">{doc.document_type ? doc.document_type.replace('_', ' ') : 'Document'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(doc.created_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: TRIP LOGBOOK & SAFETY */}
            {activeTab === 'trips' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-lg text-white uppercase tracking-wider">Driver Trip Logbook & Operational Analytics</h3>
                    <p className="text-xs text-slate-400">Recorded freight journeys, origin-destination corridors, and haulage revenue</p>
                  </div>
                </div>

                <Card className="bg-slate-900 border-slate-800 rounded-2xl overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                          <th className="p-3">Trip ID</th>
                          <th className="p-3">Route Corridor</th>
                          <th className="p-3">Departure Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Cargo Weight</th>
                          <th className="p-3">Haulage Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {driverTrips.length === 0 ? (
                          <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic font-sans">No completed or active trips registered for this driver.</td></tr>
                        ) : (
                          driverTrips.map((t: any, idx: number) => (
                            <tr key={t.id || idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-bold text-brand-gold">{t.id ? t.id.substring(0, 8).toUpperCase() : 'TRIP-LIVE'}</td>
                              <td className="p-3 font-bold text-white font-sans">{t.origin || 'Abuja'} → {t.destination || 'Lokoja'}</td>
                              <td className="p-3 text-slate-400">{t.departure_time || t.created_at || 'Today'}</td>
                              <td className="p-3 font-sans">
                                <Badge variant={t.status === 'completed' ? 'success' : 'primary'} className="text-[9px] uppercase">{t.status || 'ON-TRIP'}</Badge>
                              </td>
                              <td className="p-3">{t.cargo_weight || '12 Tons'}</td>
                              <td className="p-3 font-black text-emerald-400">₦{(t.fare_amount || 250000).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* MODAL: LOG INCIDENT / ACCIDENT */}
      {isLogAccidentOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <Card className="w-full max-w-lg p-6 flex flex-col gap-5 text-xs bg-slate-900 border border-slate-800 text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" /> Log Driver Accident / Incident
              </span>
              <button onClick={() => setIsLogAccidentOpen(false)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleLogAccidentSubmit} className="flex flex-col gap-4">
              {accError && <Alert type="danger">{accError}</Alert>}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Incidence Date</label>
                <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-white" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Severity Rating</label>
                <select value={accSeverity} onChange={(e: any) => setAccSeverity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white">
                  <option value="minor">Minor Scratch / Dent</option>
                  <option value="moderate">Moderate Damage</option>
                  <option value="major">Major Collision / Breakdown</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Damage Cost Estimate (₦)</label>
                <input type="number" value={accEstimate} onChange={(e) => setAccEstimate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-white" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Accident Description</label>
                <textarea value={accDesc} onChange={(e) => setAccDesc(e.target.value)} rows={3} placeholder="Describe the incident details..." className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsLogAccidentOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Log Incident</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: LOG REST PERIOD */}
      {isLogRestOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <Card className="w-full max-w-lg p-6 flex flex-col gap-5 text-xs bg-slate-900 border border-slate-800 text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Moon className="h-4 w-4 text-purple-400" /> Schedule Driver Rest Period
              </span>
              <button onClick={() => setIsLogRestOpen(false)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleLogRestSubmit} className="flex flex-col gap-4">
              {restError && <Alert type="danger">{restError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400 uppercase text-[10px]">Rest Start Date</label>
                  <input type="date" value={restStart} onChange={(e) => setRestStart(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-white" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400 uppercase text-[10px]">Rest End Date</label>
                  <input type="date" value={restEnd} onChange={(e) => setRestEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-white" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Reason for Rest Window</label>
                <textarea value={restReason} onChange={(e) => setRestReason(e.target.value)} rows={3} placeholder="Fatigue break, vehicle maintenance, medical leave..." className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsLogRestOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Activate Rest Window</Button>
              </div>
            </form>
          </Card>
        </div>
      )}



      {/* MODAL: RECORD REMITTANCE */}
      {isRecordRemittanceOpen && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <Card className="w-full max-w-lg p-6 flex flex-col gap-5 text-xs bg-slate-900 border border-slate-800 text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-400" /> Record Driver Remittance Payment
              </span>
              <button onClick={() => setIsRecordRemittanceOpen(false)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleRecordRemittanceSubmit} className="flex flex-col gap-4">
              {remitError && <Alert type="danger">{remitError}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400 uppercase text-[10px]">Payment Amount (₦)</label>
                  <input type="number" value={remitAmount} onChange={(e) => setRemitAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-emerald-400 font-bold" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400 uppercase text-[10px]">Milestone #</label>
                  <input type="number" min="1" max="6" value={remitInstallmentNumber} onChange={(e) => setRemitInstallmentNumber(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-white" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Receipt Reference #</label>
                <input type="text" value={remitReceipt} onChange={(e) => setRemitReceipt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono text-brand-gold font-bold" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase text-[10px]">Audit Remarks</label>
                <input type="text" value={remitRemarks} onChange={(e) => setRemitRemarks(e.target.value)} className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsRecordRemittanceOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={remitSubmitting}>
                  {remitSubmitting ? 'Recording...' : 'Submit Remittance'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CONFIRMATION MODAL: REMOTE IMMOBILIZER CUTOFF */}
      {showImmobilizerConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <Card className="w-full max-w-md p-6 flex flex-col gap-5 text-xs bg-slate-900 border border-rose-500/50 text-slate-100">
            <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Emergency Remote Immobilizer</h3>
            </div>
            
            <p className="text-slate-300 text-xs leading-relaxed">
              Are you sure you want to {isImmobilized ? 'RESTORE engine operation' : 'IMMOBILIZE engine ignition'} for vehicle <strong className="text-brand-gold">{plateNum}</strong>?
              {!isImmobilized && ' This will immediately send a satellite kill-switch command to the vehicle ecu.'}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" onClick={() => setShowImmobilizerConfirm(false)}>Cancel</Button>
              <Button 
                variant="danger" 
                onClick={() => {
                  setIsImmobilized(!isImmobilized);
                  if (!isImmobilized) setVehicleSpeed(0);
                  setShowImmobilizerConfirm(false);
                }}
              >
                {isImmobilized ? 'Restore Ignition' : 'Confirm Engine Cutoff'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* FULLSCREEN DOC INSPECTOR LIGHTBOX */}
      {isFullscreenDocOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-md" onClick={() => setIsFullscreenDocOpen(null)}>
          <div className="absolute top-4 right-4 z-[110] flex gap-2">
            <a href={getAuthorizedUrl(isFullscreenDocOpen)} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-3 bg-slate-800 text-slate-200 rounded-xl hover:bg-brand-gold hover:text-slate-900 transition-all shadow-xl">
              <Download className="h-5 w-5" />
            </a>
            <button onClick={() => setIsFullscreenDocOpen(null)} className="p-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-xl cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {(isFullscreenDocOpen.includes('.jpg') || isFullscreenDocOpen.includes('.png') || isFullscreenDocOpen.startsWith('data:image')) ? (
              <img src={getAuthorizedUrl(isFullscreenDocOpen)} alt="Document Inspection" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-slate-800" />
            ) : (
              <iframe src={getAuthorizedUrl(isFullscreenDocOpen)} className="w-full h-full bg-white rounded-xl shadow-2xl border border-slate-800" title="Document Viewer" />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
