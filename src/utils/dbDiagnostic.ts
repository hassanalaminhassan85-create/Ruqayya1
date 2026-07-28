/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function checkDatabaseConnection(): Promise<{ success: boolean; message: string; timestamp?: string }> {
  try {
    const res = await fetch('/api/db-diagnostic', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    console.log('[DB Diagnostic] Connection check successful:', data);
    return {
      success: true,
      message: data.message || 'Database connection successfully verified via SELECT 1 query.',
      timestamp: data.timestamp || new Date().toISOString()
    };
  } catch (err: any) {
    console.error('[DB Diagnostic] Connection check failed:', err);
    return {
      success: false,
      message: err.message || 'Failed to verify database connection.'
    };
  }
}
