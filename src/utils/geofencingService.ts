/**
 * Geofencing Service for Ruqayya Transport
 * Handles driver real-time GPS coordinate streams and geofence verification
 * relative to the Borno State (Maiduguri) operating hubs.
 */

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
}

export interface GeofenceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

// Maiduguri central hub and operating nodes
export const MAIDUGURI_HUB: GPSCoordinate = {
  latitude: 11.8311,
  longitude: 13.1509,
};

export const GEOFENCE_ZONES: GeofenceZone[] = [
  {
    id: "maiduguri-metro",
    name: "Maiduguri Metropolitan Core",
    latitude: 11.8311,
    longitude: 13.1509,
    radiusKm: 25.0, // 25km operating radius around city center
  },
  {
    id: "muna-garage",
    name: "Muna Garage Logistics Zone",
    latitude: 11.8480,
    longitude: 13.2080,
    radiusKm: 8.0,
  },
  {
    id: "bolori-junction",
    name: "Bolori Industrial Junction",
    latitude: 11.8520,
    longitude: 13.1310,
    radiusKm: 5.0,
  },
  {
    id: "custom-depot",
    name: "Customs Area Freight Depot",
    latitude: 11.8540,
    longitude: 13.1720,
    radiusKm: 6.0,
  },
  {
    id: "bama-road",
    name: "Bama Road Trade Corridor",
    latitude: 11.8020,
    longitude: 13.1950,
    radiusKm: 15.0,
  }
];

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 */
export function calculateDistance(coord1: GPSCoordinate, coord2: GPSCoordinate): number {
  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return parseFloat(distance.toFixed(3)); // Distance in kilometers with high precision
}

/**
 * Checks if a driver's coordinate is within any of our predefined geofenced zones.
 */
export function findMatchingZone(coordinate: GPSCoordinate): GeofenceZone | null {
  for (const zone of GEOFENCE_ZONES) {
    const distance = calculateDistance(coordinate, zone);
    if (distance <= zone.radiusKm) {
      return zone;
    }
  }
  return null;
}

/**
 * Ingests a real-time GPS position stream update from a driver.
 * Returns geofence metrics, Hub distance, status and compliance reports.
 */
export function ingestDriverTelemetry(coordinate: GPSCoordinate) {
  const distanceToHub = calculateDistance(coordinate, MAIDUGURI_HUB);
  const matchedZone = findMatchingZone(coordinate);
  
  // Geofence status is "OK" if they are within any operating zone or within a safe corridor limit of 60km of the central hub
  const isWithinHubCorridor = distanceToHub <= 60.0;
  const isGeofenceOk = matchedZone !== null || isWithinHubCorridor;

  return {
    distanceFromHubKm: distanceToHub,
    closestZone: matchedZone ? matchedZone.name : "Out of bounds / Corridor transit",
    geofenceStatus: isGeofenceOk ? "OK" : "GEOFENCE_BREACH",
    isCompliant: isGeofenceOk,
    timestamp: new Date().toISOString(),
  };
}
