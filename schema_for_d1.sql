-- Ruqayya Transport ERP - Complete Cloudflare D1 SQL Schema
-- Copy and paste this file directly into your Cloudflare D1 Console or run:
-- npx wrangler d1 execute ruqayya --file=./schema_for_d1.sql

-- 1. CLOUDFLARE WORKERS & PAGES INFRASTRUCTURE TABLES
CREATE TABLE IF NOT EXISTS collections (
  name TEXT PRIMARY KEY,
  data TEXT
);

CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  start_time DATETIME,
  end_time DATETIME,
  duration INTEGER,
  status TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  endpoint TEXT UNIQUE,
  keys TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. ACCESS CONTROL & USER MANAGEMENT
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS directors (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  company_id TEXT UNIQUE NOT NULL,
  passport_photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  company_id TEXT UNIQUE NOT NULL,
  passport_photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. FLEET & OPERATIONS
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  company_driver_id TEXT UNIQUE,
  address TEXT NOT NULL,
  nin TEXT UNIQUE NOT NULL,
  license_number TEXT UNIQUE,
  license_expiry TEXT,
  classification TEXT DEFAULT 'Assisted',
  rating REAL DEFAULT 5.0,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guarantors (
  id TEXT PRIMARY KEY,
  driver_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  relationship TEXT NOT NULL,
  nin TEXT NOT NULL,
  passport_photo_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  driver_id TEXT UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  colour TEXT NOT NULL,
  plate_number TEXT UNIQUE NOT NULL,
  registration_number TEXT UNIQUE NOT NULL,
  chassis_number TEXT UNIQUE NOT NULL,
  engine_number TEXT UNIQUE NOT NULL,
  capacity TEXT DEFAULT '30',
  mileage INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'idle',
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shareholders (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  passport_photo_url TEXT,
  phone TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  investment_amount REAL DEFAULT 0.0,
  investment_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active'
);

-- 4. DOCUMENTS & AUDIT
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS driver_documents (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title_en TEXT NOT NULL,
  title_ha TEXT NOT NULL,
  message_en TEXT NOT NULL,
  message_ha TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read_status INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
