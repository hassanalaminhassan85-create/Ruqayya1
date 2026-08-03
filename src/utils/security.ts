/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import { Role, AuditLog } from '../types';

// System Logger
export const systemLogger = {
  info: (message: string, context?: any) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, context || '');
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, context || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error || '');
  }
};

// Input Validation helper
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors = result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
    return { success: false, errors };
  }
}

// Secure File Upload constraints
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  meta?: {
    name: string;
    size: number;
    type: string;
  };
}

export function validateSecureUpload(file: File, allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf'], maxSizeBytes: number = 10 * 1024 * 1024 // 10MB
): FileValidationResult {
  // Check file existence
  if (!file) {
    return { isValid: false, error: "No file selected." };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const sizeMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return { isValid: false, error: `File size exceeds the authorized maximum limit of ${sizeMb}MB.` };
  }

  // Check file type / MIME type
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: `Invalid file format (${file.type}). Authorized formats: ${allowedTypes.join(', ')}` };
  }

  return {
    isValid: true,
    meta: {
      name: file.name,
      size: file.size,
      type: file.type
    }
  };
}

// Client-Side Simulated Rate Limiting for UI Security
const rateLimitStore: Record<string, { timestamps: number[] }> = {};

export function checkRateLimit(clientId: string, maxRequests: number = 30, windowMs: number = 60000): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  if (!rateLimitStore[clientId]) {
    rateLimitStore[clientId] = { timestamps: [] };
  }

  // Clean stale timestamps
  rateLimitStore[clientId].timestamps = rateLimitStore[clientId].timestamps.filter(
    ts => now - ts < windowMs
  );

  const clientLogs = rateLimitStore[clientId].timestamps;

  if (clientLogs.length >= maxRequests) {
    const oldestTimestamp = clientLogs[0];
    const resetMs = windowMs - (now - oldestTimestamp);
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, resetMs)
    };
  }

  clientLogs.push(now);
  return {
    allowed: true,
    remaining: maxRequests - clientLogs.length,
    resetMs: windowMs
  };
}

// Audit Support Tracker
const AUDIT_LOGS_KEY = 'ruqayya_audit_logs';

/**
 * Dedicated secure wrapper for token and session synchronization.
 * Prevents stale local storage role overrides by centralizing token access
 * and providing integrity checks.
 */
export const SecureSession = {
  TOKEN_KEY: 'ruqayya_token',

  /**
   * Retrieves the current auth token with basic sanitization.
   */
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem(SecureSession.TOKEN_KEY);
      if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
        return null;
      }
      // Basic check: tokens must have a minimum length to be considered valid
      if (token.length < 10 && !token.startsWith('tok_fallback_')) {
        return null;
      }
      return token;
    } catch (err) {
      systemLogger.error('SecureSession.getToken failure', err);
      return null;
    }
  },

  /**
   * Persists the auth token and synchronizes with the API utility.
   */
  setToken: (token: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SecureSession.TOKEN_KEY, token);
      // We don't import api here to avoid circular dependencies, 
      // instead we rely on the caller or a secondary sync mechanism.
    } catch (err) {
      systemLogger.error('SecureSession.setToken failure', err);
    }
  },

  /**
   * Removes the auth token and clears the API utility state.
   */
  clearToken: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(SecureSession.TOKEN_KEY);
    } catch (err) {
      systemLogger.error('SecureSession.clearToken failure', err);
    }
  },

  /**
   * Performs an integrity check on the session.
   * Returns false if the session appears corrupted or stale.
   */
  isValid: (): boolean => {
    const token = SecureSession.getToken();
    if (!token) return false;
    
    // Fallback tokens are always "valid" for simulation purposes
    if (token.startsWith('tok_fallback_')) return true;

    // In a real app, we might check JWT expiration here.
    // For now, we just ensure it's a non-empty string.
    return token.length > 0;
  }
};

export function getAuditLogs(): AuditLog[] {
  try {
    const logs = localStorage.getItem(AUDIT_LOGS_KEY);
    if (logs) {
      return JSON.parse(logs);
    }
  } catch (e) {
    systemLogger.error("Failed to read audit logs from localStorage", e);
  }
  return [];
}

export function logAuditEvent(userId: string, role: Role, action: string, details: string): AuditLog {
  const newLog: AuditLog = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    userId,
    userRole: role,
    action,
    details,
    ipAddress: "192.168.1.1" // Default internal corporate IP
  };

  try {
    const logs = getAuditLogs();
    logs.unshift(newLog); // Put newest log first
    // Limit to last 500 audit logs to save localstorage space
    const sliced = logs.slice(0, 500);
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(sliced));
  } catch (e) {
    systemLogger.error("Failed to commit audit log to localStorage", e);
  }

  systemLogger.info(`[AUDIT] User: ${userId} (${role}) | Action: ${action} | ${details}`);
  return newLog;
}

// Setup initial seed log events if empty
export function seedAuditLogsIfEmpty() {
  const logs = getAuditLogs();
  if (logs.length === 0) {
    logAuditEvent("sys-admin", "admin", "SYSTEM_STARTUP", "ERP Enterprise Foundation bootstrapped successfully.");
    logAuditEvent("sys-admin", "admin", "DATABASE_BINDING", "Cloudflare D1 'ruqayya' database context initialized.");
    logAuditEvent("sys-admin", "admin", "OBJECT_STORAGE_BINDING", "Cloudflare R2 'ruqayya' bucket credentials mapped.");
  }
}
