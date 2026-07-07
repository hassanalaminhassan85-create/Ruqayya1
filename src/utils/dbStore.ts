/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vehicle, Driver, TripManifest, FuelVoucher, FinancialRecord, AppNotification, Role } from '../types';
import { logAuditEvent, systemLogger } from './security';

// Keys for LocalStorage
const VEHICLES_KEY = 'ruqayya_vehicles';
const DRIVERS_KEY = 'ruqayya_drivers';
const TRIPS_KEY = 'ruqayya_trips';
const VOUCHERS_KEY = 'ruqayya_vouchers';
const FINANCE_KEY = 'ruqayya_finance';
const NOTIFICATIONS_KEY = 'ruqayya_notifications';

// --- SEED DATA ---
const DEFAULT_VEHICLES: Vehicle[] = [
  { id: 'V-001', plateNumber: 'KANO-432-KN', model: 'Mercedes-Benz Actros 3340', status: 'assigned', fuelType: 'diesel', capacity: '30', driverId: 'D-001', lastServiceDate: '2026-06-15', mileage: 124500 },
  { id: 'V-002', plateNumber: 'LAG-981-LA', model: 'Volvo FH16 Globetrotter', status: 'assigned', fuelType: 'diesel', capacity: '45', driverId: 'D-002', lastServiceDate: '2026-05-20', mileage: 98120 },
  { id: 'V-003', plateNumber: 'ABJ-231-AB', model: 'DAF XF 105 Heavy Hauler', status: 'idle', fuelType: 'diesel', capacity: '40', lastServiceDate: '2026-06-01', mileage: 145900 },
  { id: 'V-004', plateNumber: 'KAD-776-KD', model: 'Scania R500 V8 Streamline', status: 'maintenance', fuelType: 'diesel', capacity: '35', lastServiceDate: '2026-07-01', mileage: 84300 }
];

const DEFAULT_DRIVERS: Driver[] = [
  { id: 'D-001', fullName: 'Alhaji Musa Garba', licenseNumber: 'NGA-DL-882103', licenseExpiry: '2028-11-12', phone: '+234 803 123 4567', email: 'musa.garba@ruqayyatransport.com', status: 'on-trip', assignedVehicleId: 'V-001', rating: 4.8 },
  { id: 'D-002', fullName: 'Babangida Ibrahim', licenseNumber: 'NGA-DL-119280', licenseExpiry: '2027-04-18', phone: '+234 806 987 6543', email: 'b.ibrahim@ruqayyatransport.com', status: 'on-trip', assignedVehicleId: 'V-002', rating: 4.9 },
  { id: 'D-003', fullName: 'Sani Yusuf Bello', licenseNumber: 'NGA-DL-554612', licenseExpiry: '2029-01-30', phone: '+234 812 345 6789', email: 'sani.yusuf@ruqayyatransport.com', status: 'available', rating: 4.5 },
  { id: 'D-004', fullName: 'Ruqayya Kabir Mohammed', licenseNumber: 'NGA-DL-302194', licenseExpiry: '2028-08-15', phone: '+234 905 555 1234', email: 'ruqayya.k@ruqayyatransport.com', status: 'off-duty', rating: 5.0 }
];

const DEFAULT_TRIPS: TripManifest[] = [
  { id: 'T-1001', manifestNumber: 'MNF-2026-0091', vehicleId: 'V-001', driverId: 'D-001', origin: 'Kano Dry Port', destination: 'Apapa Port, Lagos', departureTime: '2026-07-06 06:00', expectedArrivalTime: '2026-07-08 18:00', status: 'in-transit', cargoType: 'Agricultural Produce (Sesame Seeds)', weight: 28, freightCharges: 1850000 },
  { id: 'T-1002', manifestNumber: 'MNF-2026-0092', vehicleId: 'V-002', driverId: 'D-002', origin: 'Abuja Industrial Area', destination: 'Port Harcourt Onne Port', departureTime: '2026-07-05 08:30', expectedArrivalTime: '2026-07-07 16:00', status: 'in-transit', cargoType: 'Manufactured Goods', weight: 42, freightCharges: 2400000 },
  { id: 'T-1003', manifestNumber: 'MNF-2026-0089', vehicleId: 'V-003', driverId: 'D-003', origin: 'Kaduna Depot', destination: 'Maiduguri Center', departureTime: '2026-06-28 05:00', expectedArrivalTime: '2026-06-30 14:00', status: 'delivered', cargoType: 'Emergency Relief Food Supplies', weight: 38, freightCharges: 1950000 }
];

const DEFAULT_VOUCHERS: FuelVoucher[] = [
  { id: 'FV-501', voucherNumber: 'FL-2026-7781', vehicleId: 'V-001', driverId: 'D-001', litersRequested: 450, estimatedCost: 652500, status: 'approved', requestDate: '2026-07-05 14:00', approvalDate: '2026-07-05 15:30' },
  { id: 'FV-502', voucherNumber: 'FL-2026-7782', vehicleId: 'V-002', driverId: 'D-002', litersRequested: 600, estimatedCost: 870000, status: 'approved', requestDate: '2026-07-05 16:15', approvalDate: '2026-07-05 16:45' },
  { id: 'FV-503', voucherNumber: 'FL-2026-7783', vehicleId: 'V-001', driverId: 'D-001', litersRequested: 350, estimatedCost: 507500, status: 'pending', requestDate: '2026-07-07 09:00' }
];

const DEFAULT_FINANCE: FinancialRecord[] = [
  { id: 'FIN-001', type: 'revenue', category: 'freight', amount: 1950000, date: '2026-06-30', referenceId: 'T-1003', description: 'Payment for Manifest MNF-2026-0089 Delivered' },
  { id: 'FIN-002', type: 'expense', category: 'fuel', amount: 652500, date: '2026-07-05', referenceId: 'FV-501', description: 'Fuel purchase - Voucher FL-2026-7781', approvedBy: 'Admin Ibrahim' },
  { id: 'FIN-003', type: 'expense', category: 'fuel', amount: 870000, date: '2026-07-05', referenceId: 'FV-502', description: 'Fuel purchase - Voucher FL-2026-7782', approvedBy: 'Admin Ibrahim' },
  { id: 'FIN-004', type: 'expense', category: 'maintenance', amount: 320000, date: '2026-07-01', referenceId: 'V-004', description: 'Routine maintenance and brake pad replacement for V-004' },
  { id: 'FIN-005', type: 'revenue', category: 'freight', amount: 2200000, date: '2026-06-25', description: 'Downpayment for bulk steel transit contract - Dangote Group' }
];

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  { id: 'N-1', titleEn: 'New Fuel Voucher Request', titleHa: 'Sabuwar Bukatar Takardar Mai', messageEn: 'Driver Alhaji Musa requested a fuel voucher for 350 Liters.', messageHa: 'Direba Alhaji Musa ya nemi takardar mai lita 350.', timestamp: '2026-07-07 09:00', read: false, type: 'warning' },
  { id: 'N-2', titleEn: 'Vehicle V-004 Serviced', titleHa: 'An Gyara Mota V-004', messageEn: 'Vehicle V-004 is back in service after undergoing hydraulic inspections.', messageHa: 'Mota V-004 ta dawo aiki bayan an duba na\'urar hydraulic.', timestamp: '2026-07-01 10:00', read: true, type: 'success' },
  { id: 'N-3', titleEn: 'Audit Alert: Configuration Modified', titleHa: 'Sanarwar Tsaro: An Sauya Tsarin Na\'ura', messageEn: 'System architecture updated with Cloudflare Worker pipelines.', messageHa: 'An sabunta tsarin gudanarwa tare da bututun Cloudflare Worker.', timestamp: '2026-07-07 04:35', read: false, type: 'info' }
];

// Helper to safely fetch from localStorage
function getStoreItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
    // Seed it
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  } catch (e) {
    systemLogger.error(`Failed to load ${key} from storage`, e);
    return defaultValue;
  }
}

// Helper to save to localStorage
function saveStoreItem<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    systemLogger.error(`Failed to save ${key} to storage`, e);
  }
}

// Core DB Wrapper API
export const dbStore = {
  // Vehicles
  getVehicles: (): Vehicle[] => getStoreItem(VEHICLES_KEY, DEFAULT_VEHICLES),
  saveVehicles: (data: Vehicle[]) => saveStoreItem(VEHICLES_KEY, data),
  addVehicle: (vehicle: Omit<Vehicle, 'id'>): Vehicle => {
    const vehicles = dbStore.getVehicles();
    const id = `V-${(vehicles.length + 1).toString().padStart(3, '0')}`;
    const newVehicle: Vehicle = { id, ...vehicle };
    vehicles.push(newVehicle);
    dbStore.saveVehicles(vehicles);
    logAuditEvent("user-session", "admin", "ADD_VEHICLE", `Added vehicle ${id} (${vehicle.plateNumber})`);
    return newVehicle;
  },
  updateVehicle: (id: string, updates: Partial<Vehicle>): Vehicle | null => {
    const vehicles = dbStore.getVehicles();
    const idx = vehicles.findIndex(v => v.id === id);
    if (idx === -1) return null;
    vehicles[idx] = { ...vehicles[idx], ...updates };
    dbStore.saveVehicles(vehicles);
    logAuditEvent("user-session", "admin", "UPDATE_VEHICLE", `Updated vehicle ${id} parameters.`);
    return vehicles[idx];
  },

  // Drivers
  getDrivers: (): Driver[] => getStoreItem(DRIVERS_KEY, DEFAULT_DRIVERS),
  saveDrivers: (data: Driver[]) => saveStoreItem(DRIVERS_KEY, data),
  addDriver: (driver: Omit<Driver, 'id' | 'rating' | 'status'>): Driver => {
    const drivers = dbStore.getDrivers();
    const id = `D-${(drivers.length + 1).toString().padStart(3, '0')}`;
    const newDriver: Driver = { id, ...driver, rating: 5.0, status: 'available' };
    drivers.push(newDriver);
    dbStore.saveDrivers(drivers);
    logAuditEvent("user-session", "admin", "REGISTER_DRIVER", `Registered driver ${id} - ${driver.fullName}`);
    return newDriver;
  },
  updateDriver: (id: string, updates: Partial<Driver>): Driver | null => {
    const drivers = dbStore.getDrivers();
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) return null;
    drivers[idx] = { ...drivers[idx], ...updates };
    dbStore.saveDrivers(drivers);
    logAuditEvent("user-session", "admin", "UPDATE_DRIVER", `Updated driver ${id} profile metadata.`);
    return drivers[idx];
  },

  // Trip Manifests
  getTrips: (): TripManifest[] => getStoreItem(TRIPS_KEY, DEFAULT_TRIPS),
  saveTrips: (data: TripManifest[]) => saveStoreItem(TRIPS_KEY, data),
  addTrip: (trip: Omit<TripManifest, 'id' | 'manifestNumber'>): TripManifest => {
    const trips = dbStore.getTrips();
    const id = `T-${Date.now()}`;
    const manifestNumber = `MNF-2026-${(trips.length + 1).toString().padStart(4, '0')}`;
    const newTrip: TripManifest = { id, manifestNumber, ...trip };
    trips.push(newTrip);
    dbStore.saveTrips(trips);

    // Update vehicle and driver status
    dbStore.updateVehicle(trip.vehicleId, { status: 'assigned' });
    dbStore.updateDriver(trip.driverId, { status: 'on-trip', assignedVehicleId: trip.vehicleId });

    logAuditEvent("user-session", "admin", "DISPATCH_MANIFEST", `Dispatched manifest ${manifestNumber} (${trip.origin} -> ${trip.destination})`);
    return newTrip;
  },
  completeTrip: (tripId: string, responderId: string, responderRole: 'admin' | 'driver'): boolean => {
    const trips = dbStore.getTrips();
    const tripIdx = trips.findIndex(t => t.id === tripId);
    if (tripIdx === -1) return false;
    
    const trip = trips[tripIdx];
    if (trip.status === 'delivered') return true;

    trip.status = 'delivered';
    dbStore.saveTrips(trips);

    // Release vehicle and driver
    dbStore.updateVehicle(trip.vehicleId, { status: 'idle' });
    dbStore.updateDriver(trip.driverId, { status: 'available' });

    // Add financial revenue record
    dbStore.addFinancialRecord({
      type: 'revenue',
      category: 'freight',
      amount: trip.freightCharges,
      date: new Date().toISOString().split('T')[0],
      referenceId: trip.id,
      description: `Revenue collected for Delivered Manifest ${trip.manifestNumber}`
    }, responderId, "admin");

    logAuditEvent(responderId, responderRole, "COMPLETE_TRIP", `Manifest ${trip.manifestNumber} logged as DELIVERED. Revenue calculated: ₦${trip.freightCharges.toLocaleString()}`);
    return true;
  },

  // Fuel Vouchers
  getVouchers: (): FuelVoucher[] => getStoreItem(VOUCHERS_KEY, DEFAULT_VOUCHERS),
  saveVouchers: (data: FuelVoucher[]) => saveStoreItem(VOUCHERS_KEY, data),
  addVoucher: (voucher: Omit<FuelVoucher, 'id' | 'voucherNumber' | 'status' | 'requestDate'>): FuelVoucher => {
    const vouchers = dbStore.getVouchers();
    const id = `FV-${Date.now()}`;
    const voucherNumber = `FL-2026-${(vouchers.length + 1).toString().padStart(4, '0')}`;
    const newVoucher: FuelVoucher = {
      id,
      voucherNumber,
      ...voucher,
      status: 'pending',
      requestDate: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    vouchers.unshift(newVoucher); // Add at top for pending reviews
    dbStore.saveVouchers(vouchers);

    // Notify admins
    dbStore.addNotification({
      titleEn: 'New Fuel Request Raised',
      titleHa: 'Sabuwar Bukatar Takardar Mai',
      messageEn: `Driver has raised a request for ${voucher.litersRequested} liters (₦${voucher.estimatedCost.toLocaleString()}).`,
      messageHa: `Direba ya tura buƙatar lita ${voucher.litersRequested} (₦${voucher.estimatedCost.toLocaleString()}).`,
      type: 'warning'
    });

    logAuditEvent(voucher.driverId, "driver", "FUEL_VOUCHER_REQUEST", `Driver requested ${voucher.litersRequested} liters, value: ₦${voucher.estimatedCost.toLocaleString()}`);
    return newVoucher;
  },
  approveVoucher: (voucherId: string, approverId: string): boolean => {
    const vouchers = dbStore.getVouchers();
    const idx = vouchers.findIndex(v => v.id === voucherId);
    if (idx === -1) return false;

    const voucher = vouchers[idx];
    if (voucher.status !== 'pending') return true;

    voucher.status = 'approved';
    voucher.approvalDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    dbStore.saveVouchers(vouchers);

    // Commit fuel expense to ledger
    dbStore.addFinancialRecord({
      type: 'expense',
      category: 'fuel',
      amount: voucher.estimatedCost,
      date: new Date().toISOString().split('T')[0],
      referenceId: voucher.id,
      description: `Fuel purchase authorization - Voucher ${voucher.voucherNumber}`,
      approvedBy: approverId
    }, approverId, "admin");

    // Add success notification
    dbStore.addNotification({
      titleEn: 'Fuel Voucher Approved',
      titleHa: 'An Amince Da Takardar Mai',
      messageEn: `Fuel voucher ${voucher.voucherNumber} approved for ${voucher.litersRequested}L.`,
      messageHa: `An amince da takardar mai ${voucher.voucherNumber} na lita ${voucher.litersRequested}.`,
      type: 'success'
    });

    logAuditEvent(approverId, "admin", "APPROVE_FUEL_VOUCHER", `Approved fuel voucher ${voucher.voucherNumber} for ₦${voucher.estimatedCost.toLocaleString()}`);
    return true;
  },

  // Financial Ledger
  getFinance: (): FinancialRecord[] => getStoreItem(FINANCE_KEY, DEFAULT_FINANCE),
  saveFinance: (data: FinancialRecord[]) => saveStoreItem(FINANCE_KEY, data),
  addFinancialRecord: (record: Omit<FinancialRecord, 'id'>, actorId: string, actorRole: Role): FinancialRecord => {
    const ledger = dbStore.getFinance();
    const id = `FIN-${Date.now()}`;
    const newRecord: FinancialRecord = { id, ...record };
    ledger.unshift(newRecord);
    dbStore.saveFinance(ledger);
    logAuditEvent(actorId, actorRole, "LEDGER_WRITE", `Logged ${record.type} under category ${record.category}: ₦${record.amount.toLocaleString()}`);
    return newRecord;
  },

  // Notifications
  getNotifications: (): AppNotification[] => getStoreItem(NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS),
  saveNotifications: (data: AppNotification[]) => saveStoreItem(NOTIFICATIONS_KEY, data),
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification => {
    const list = dbStore.getNotifications();
    const id = `N-${Date.now()}`;
    const newNotification: AppNotification = {
      id,
      ...notification,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: false
    };
    list.unshift(newNotification);
    dbStore.saveNotifications(list);
    return newNotification;
  },
  markAllNotificationsRead: () => {
    const list = dbStore.getNotifications();
    const updated = list.map(n => ({ ...n, read: true }));
    dbStore.saveNotifications(updated);
  }
};
