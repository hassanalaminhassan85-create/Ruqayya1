-- Migration 0001: Initial Ruqayya Transport ERP Schema
-- Target Platform: Cloudflare D1 (SQLite)

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, -- UUID
  name TEXT UNIQUE NOT NULL, -- 'director', 'admin', 'driver', 'shareholder', 'public'
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

-- 2. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, -- UUID
  name TEXT UNIQUE NOT NULL, -- e.g. 'view_dashboards', 'approve_drivers', 'manage_finance'
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

-- 3. Role-Permissions Join Table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 4. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UUID
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'rejected'
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 5. Directors Table
CREATE TABLE IF NOT EXISTS directors (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT UNIQUE NOT NULL,
  company_id TEXT UNIQUE NOT NULL,
  passport_photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT UNIQUE NOT NULL,
  company_id TEXT UNIQUE NOT NULL,
  passport_photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending approval by director
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT UNIQUE NOT NULL,
  company_driver_id TEXT UNIQUE, -- e.g. DRV-001, assigned after approval
  address TEXT NOT NULL,
  nin TEXT UNIQUE NOT NULL,
  license_number TEXT UNIQUE,
  license_expiry TEXT,
  classification TEXT NOT NULL DEFAULT 'Assisted', -- 'Smart' or 'Assisted'
  rating REAL DEFAULT 5.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'correction_requested'
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Shareholders Table
CREATE TABLE IF NOT EXISTS shareholders (
  id TEXT PRIMARY KEY, -- UUID
  full_name TEXT NOT NULL,
  passport_photo_url TEXT,
  phone TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  investment_amount REAL NOT NULL DEFAULT 0.0,
  investment_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended'
  user_id TEXT UNIQUE -- optional if they are linked to a user account
);

-- 9. Guarantors Table
CREATE TABLE IF NOT EXISTS guarantors (
  id TEXT PRIMARY KEY, -- UUID
  driver_id TEXT UNIQUE NOT NULL, -- One guarantor per driver
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  relationship TEXT NOT NULL,
  nin TEXT NOT NULL,
  passport_photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- 10. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY, -- UUID
  driver_id TEXT UNIQUE, -- nullable, linked to approved driver
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  colour TEXT NOT NULL,
  plate_number TEXT UNIQUE NOT NULL,
  registration_number TEXT UNIQUE NOT NULL,
  chassis_number TEXT UNIQUE NOT NULL,
  engine_number TEXT UNIQUE NOT NULL,
  capacity TEXT NOT NULL DEFAULT '30',
  mileage INTEGER NOT NULL DEFAULT 0,
  last_service_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'assigned', 'maintenance'
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- 11. Vehicle Documents Table
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id TEXT PRIMARY KEY, -- UUID
  vehicle_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'registration', 'insurance', 'road_worthiness', 'ownership', 'inspection'
  file_url TEXT NOT NULL,
  expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 12. Driver Documents Table
CREATE TABLE IF NOT EXISTS driver_documents (
  id TEXT PRIMARY KEY, -- UUID
  driver_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'license', 'nin', 'passport_photo', 'guarantor_passport'
  file_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- 13. Company Documents Table
CREATE TABLE IF NOT EXISTS company_documents (
  id TEXT PRIMARY KEY, -- UUID
  title TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'regulatory', 'safety_score', 'voucher_receipt', 'general'
  file_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

-- 14. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  user_ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT, -- Nullable for public/anonymous actions
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

-- 16. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT, -- Nullable for system-wide notifications
  title_en TEXT NOT NULL,
  title_ha TEXT NOT NULL,
  message_en TEXT NOT NULL,
  message_ha TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'success', 'danger'
  read_status INTEGER NOT NULL DEFAULT 0, -- 0 = unread, 1 = read
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 17. User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT UNIQUE NOT NULL,
  language TEXT NOT NULL DEFAULT 'en', -- 'en' or 'ha'
  theme TEXT NOT NULL DEFAULT 'light', -- 'light' or 'dark'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CREATE INDEXES FOR HIGH-SPEED LOOKUPS
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
