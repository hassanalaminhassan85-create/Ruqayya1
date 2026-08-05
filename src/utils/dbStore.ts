import { Vehicle, Driver, DailyRemittance, FinancialRecord, AppNotification, Role } from "../types";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logAuditEvent, systemLogger } from './security';

// Keys for LocalStorage
const VEHICLES_KEY = 'ruqayya_vehicles';
const DRIVERS_KEY = 'ruqayya_drivers';
const TRIPS_KEY = 'ruqayya_trips';
const FINANCE_KEY = 'ruqayya_finance';
const NOTIFICATIONS_KEY = 'ruqayya_notifications';

// --- SEED DATA ---
const DEFAULT_VEHICLES: Vehicle[] = [
  { id: 'V-001', plateNumber: 'BORNO-432-BO', model: 'Bajaj RE 250 (Passenger Keke)', status: 'assigned', fuelType: 'petrol', capacity: '3-Seater', driverId: 'D-001', lastServiceDate: '2026-06-15', mileage: 12450 },
  { id: 'V-002', plateNumber: 'LAG-981-LA', model: 'TVS King Deluxe Keke', status: 'assigned', fuelType: 'petrol', capacity: '3-Seater', driverId: 'D-002', lastServiceDate: '2026-05-20', mileage: 9812 },
  { id: 'V-003', plateNumber: 'ABJ-231-AB', model: 'Piaggio Ape City Keke', status: 'idle', fuelType: 'petrol', capacity: '3-Seater', lastServiceDate: '2026-06-01', mileage: 14590 },
  { id: 'V-004', plateNumber: 'KAD-776-KD', model: 'Daylong Utility Tricycle', status: 'maintenance', fuelType: 'petrol', capacity: 'Heavy Load', lastServiceDate: '2026-07-01', mileage: 8430 }
];

const DEFAULT_DRIVERS: Driver[] = [
  { id: 'D-001', fullName: 'Driver MUSA', licenseNumber: 'NGA-DL-882103', licenseExpiry: '2028-11-12', phone: '+234 803 123 4567', email: 'musa.driver@ruqayyatransport.com', status: 'on-trip', assignedVehicleId: 'V-001', rating: 4.8 },
  { id: 'D-002', fullName: 'Babangida Ibrahim', licenseNumber: 'NGA-DL-119280', licenseExpiry: '2027-04-18', phone: '+234 806 987 6543', email: 'b.ibrahim@ruqayyatransport.com', status: 'on-trip', assignedVehicleId: 'V-002', rating: 4.9 },
  { id: 'D-003', fullName: 'Sani Yusuf Bello', licenseNumber: 'NGA-DL-554612', licenseExpiry: '2029-01-30', phone: '+234 812 345 6789', email: 'sani.yusuf@ruqayyatransport.com', status: 'available', rating: 4.5 },
  { id: 'D-004', fullName: 'Ruqayya Kabir Mohammed', licenseNumber: 'NGA-DL-302194', licenseExpiry: '2028-08-15', phone: '+234 905 555 1234', email: 'ruqayya.k@ruqayyatransport.com', status: 'off-duty', rating: 5.0 }
];

const DEFAULT_TRIPS: DailyRemittance[] = [
  { id: 'T-1001', remittanceNumber: 'REM-2026-0091', vehicleId: 'V-001', driverId: 'D-001', origin: 'Kano Central Terminal', destination: 'Zaria Road Depot', departureTime: '2026-07-06 06:00', expectedArrivalTime: '2026-07-08 18:00', status: 'in-transit', tricycleType: 'Passenger Keke', remittanceCount: 1, remittanceAmount: 15000 },
  { id: 'T-1002', remittanceNumber: 'REM-2026-0092', vehicleId: 'V-002', driverId: 'D-002', origin: 'Abuja Garki Hub', destination: 'Wuse Market Center', departureTime: '2026-07-05 08:30', expectedArrivalTime: '2026-07-07 16:00', status: 'in-transit', tricycleType: 'Passenger Keke', remittanceCount: 1, remittanceAmount: 15000 },
  { id: 'T-1003', remittanceNumber: 'REM-2026-0089', vehicleId: 'V-003', driverId: 'D-003', origin: 'Kaduna Central Terminal', destination: 'Kawo Hub', departureTime: '2026-06-28 05:00', expectedArrivalTime: '2026-06-30 14:00', status: 'delivered', tricycleType: 'Utility Tricycle', remittanceCount: 1, remittanceAmount: 18000 }
];


const DEFAULT_FINANCE: FinancialRecord[] = [
  { id: 'FIN-001', type: 'revenue', category: 'remittance', amount: 18000, date: '2026-06-30', referenceId: 'T-1003', description: 'Remittance processed for daily collection REM-2026-0089' },
  { id: 'FIN-002', type: 'expense', category: 'fuel', amount: 15000, date: '2026-07-05', referenceId: 'FV-501', description: 'Driver wallet funding - Voucher FL-2026-7781', approvedBy: 'Admin Ibrahim' },
  { id: 'FIN-003', type: 'expense', category: 'fuel', amount: 20000, date: '2026-07-05', referenceId: 'FV-502', description: 'Driver wallet funding - Voucher FL-2026-7782', approvedBy: 'Admin Ibrahim' },
  { id: 'FIN-004', type: 'expense', category: 'maintenance', amount: 8000, date: '2026-07-01', referenceId: 'V-004', description: 'Routine engine service and filter replacement for V-004' },
  { id: 'FIN-005', type: 'revenue', category: 'remittance', amount: 75000, date: '2026-06-25', description: '5-Day cycle collection under lease agreement' }
];

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  { id: 'N-1', titleEn: 'New Driver Wallet Request', titleHa: 'Sabuwar Bukatar Asusun Direba', messageEn: 'Driver Alhaji Musa requested a wallet voucher of ₦10,000.', messageHa: 'Direba Alhaji Musa ya nemi kudin asusu na ₦10,000.', timestamp: '2026-07-07 09:00', read: false, type: 'warning' },
  { id: 'N-2', titleEn: 'Tricycle V-004 Serviced', titleHa: 'An Gyara Keke V-004', messageEn: 'Tricycle V-004 is back in service after undergoing spark plug checks.', messageHa: 'An gyara Keke V-004 kuma ya dawo aiki.', timestamp: '2026-07-01 10:00', read: true, type: 'success' },
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

function saveStoreItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    systemLogger.error(`Failed to save ${key} to storage`, e);
  }
}

export const dbStore = {
  // Vehicles (Tricycles)
  getVehicles: (): Vehicle[] => getStoreItem(VEHICLES_KEY, DEFAULT_VEHICLES),
  saveVehicles: (data: Vehicle[]) => saveStoreItem(VEHICLES_KEY, data),
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'status'>): Vehicle => {
    const vehicles = dbStore.getVehicles();
    const id = `V-${(vehicles.length + 1).toString().padStart(3, '0')}`;
    const newVehicle: Vehicle = { id, ...vehicle, status: 'idle' };
    vehicles.push(newVehicle);
    dbStore.saveVehicles(vehicles);
    logAuditEvent("user-session", "admin", "REGISTER_TRICYCLE", `Registered tricycle ${id} - ${vehicle.plateNumber}`);
    return newVehicle;
  },
  updateVehicle: (id: string, updates: Partial<Vehicle>): Vehicle | null => {
    const vehicles = dbStore.getVehicles();
    const idx = vehicles.findIndex(v => v.id === id);
    if (idx === -1) return null;
    vehicles[idx] = { ...vehicles[idx], ...updates };
    dbStore.saveVehicles(vehicles);
    logAuditEvent("user-session", "admin", "UPDATE_TRICYCLE", `Updated tricycle ${id} parameters.`);
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

  // Daily Remittances (formerly Trip Manifests)
  getTrips: (): DailyRemittance[] => getStoreItem(TRIPS_KEY, DEFAULT_TRIPS),
  saveTrips: (data: DailyRemittance[]) => saveStoreItem(TRIPS_KEY, data),
  addTrip: (trip: Omit<DailyRemittance, 'id' | 'remittanceNumber'>): DailyRemittance => {
    const trips = dbStore.getTrips();
    const id = `T-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const remittanceNumber = `REM-2026-${(trips.length + 1).toString().padStart(4, '0')}`;
    const newTrip: DailyRemittance = { id, remittanceNumber, ...trip };
    trips.push(newTrip);
    dbStore.saveTrips(trips);

    // Update vehicle and driver status
    dbStore.updateVehicle(trip.vehicleId, { status: 'assigned' });
    dbStore.updateDriver(trip.driverId, { status: 'on-trip', assignedVehicleId: trip.vehicleId });

    logAuditEvent("user-session", "admin", "DISPATCH_REMITTANCE", `Logged daily remittance ${remittanceNumber} (${trip.origin} -> ${trip.destination})`);
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

    logAuditEvent(responderId, responderRole, "COMPLETE_REMITTANCE", `Daily remittance ${trip.remittanceNumber} completed. Revenue collected: ₦${trip.remittanceAmount.toLocaleString()}`);
    return true;
  },
  getNotifications: (): AppNotification[] => getStoreItem(NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS),

  saveNotifications: (data: AppNotification[]) => saveStoreItem(NOTIFICATIONS_KEY, data),
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification => {
    const list = dbStore.getNotifications();
    const id = `N-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
