-- Migration 0002: Real-time Vehicle Telemetry & Location Tracking Schema
-- Target Platform: Cloudflare D1 (SQLite)

-- 1. Vehicle Locations Table (Stores the latest real-time status of each active vehicle/driver tracking session)
CREATE TABLE IF NOT EXISTS vehicle_locations (
  id TEXT PRIMARY KEY, -- Unique ID (UUID)
  driver_id TEXT NOT NULL, -- Foreign key to drivers(id)
  vehicle_id TEXT, -- Foreign key to vehicles(id), nullable if vehicle not yet assigned
  company_id TEXT NOT NULL, -- Multi-tenant company/tenant isolation boundary
  latitude REAL NOT NULL, -- Latest GPS Latitude (-90 to +90)
  longitude REAL NOT NULL, -- Latest GPS Longitude (-180 to +180)
  accuracy REAL, -- GPS Accuracy in meters
  altitude REAL, -- Altitude in meters
  speed REAL, -- Speed in km/h or m/s
  heading REAL, -- Direction/heading in degrees (0 to 360)
  battery_level REAL, -- Device battery level percentage (0 to 100)
  is_moving INTEGER NOT NULL DEFAULT 0, -- 0 = Stationary/Idle, 1 = Moving
  status TEXT NOT NULL DEFAULT 'unknown', -- 'LIVE/MOVING', 'LIVE/IDLE', 'STALE', 'OFFLINE', 'GPS_UNAVAILABLE'
  place_name TEXT, -- Human-readable reverse-geocoded location name
  last_gps_update TEXT NOT NULL, -- ISO 8601 timestamp of last hardware GPS coordinate reception
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Location Events Table (Chronological high-frequency GPS historical trail for route history & distance analysis)
CREATE TABLE IF NOT EXISTS location_events (
  id TEXT PRIMARY KEY, -- Unique Event ID (UUID)
  location_id TEXT, -- Optional relation linking back to vehicle_locations state ID
  driver_id TEXT NOT NULL, -- Foreign key to drivers(id)
  vehicle_id TEXT, -- Foreign key to vehicles(id)
  company_id TEXT NOT NULL, -- Multi-tenant company/tenant isolation boundary
  latitude REAL NOT NULL, -- GPS Latitude
  longitude REAL NOT NULL, -- GPS Longitude
  accuracy REAL, -- Accuracy in meters
  altitude REAL, -- Altitude in meters
  speed REAL, -- Speed
  heading REAL, -- Heading
  timestamp TEXT NOT NULL, -- ISO 8601 timestamp of event creation at source (device)
  received_at TEXT NOT NULL DEFAULT (datetime('now')), -- ISO 8601 timestamp of reception on server
  source TEXT NOT NULL DEFAULT 'gps', -- Source type: 'gps', 'network', 'fused', 'cell'
  battery_level REAL, -- Device battery level percentage (0 to 100)
  is_moving INTEGER NOT NULL DEFAULT 0, -- 0 = Stationary/Idle, 1 = Moving
  status TEXT, -- Status at the time of the event
  distance_delta REAL DEFAULT 0.0 -- Haversine distance offset from previous chronological event in km
);

-- 3. Indexes for Multi-Tenant Partitioning, Driver Identity, and High-Speed Real-Time Analytics Queries
CREATE INDEX IF NOT EXISTS idx_vehicle_loc_driver ON vehicle_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_loc_company ON vehicle_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_loc_updated ON vehicle_locations(updated_at);

CREATE INDEX IF NOT EXISTS idx_loc_events_driver ON location_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_loc_events_company ON location_events(company_id);
CREATE INDEX IF NOT EXISTS idx_loc_events_timestamp ON location_events(timestamp);

-- Compound index to facilitate fast geospatial queries (bounding box scanning over latitude & longitude)
CREATE INDEX IF NOT EXISTS idx_loc_events_geospatial ON location_events(latitude, longitude);
