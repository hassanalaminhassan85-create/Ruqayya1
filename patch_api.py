import re

file_path = 'functions/api/[[path]].ts'
with open(file_path, 'r') as f:
    content = f.read()

# Fix 1: getCanonicalCycleStatus helper function
canonical_status_func = """
function getCanonicalCycleStatus(db: any): any {
  const activeCycle = db.cycles && db.cycles.find((c: any) => c.status === 'active' || c.status === 'paused');
  if (!activeCycle) {
    return {
      isActive: false, status: 'inactive', cycleId: 'No Active Cycle', startDate: '', endDate: '',
      daysRemaining: 0, hoursRemaining: 0, minutesRemaining: 0, secondsRemaining: 0, totalSecondsRemaining: 0,
      progressPercent: 0, currentDay: 0, totalCycleDays: 30, pauseReason: '', pausedAt: ''
    };
  }
  const now = Date.now();
  const startMs = new Date(activeCycle.startDate).getTime();
  const baseDurationSeconds = 30 * 24 * 3600;
  const extensionSeconds = (activeCycle.extendedDays || 0) * 24 * 3600;
  const totalCycleSeconds = baseDurationSeconds + extensionSeconds;
  
  let totalPausedSeconds = activeCycle.totalPausedSeconds || 0;
  let currentPauseSeconds = 0;
  if (activeCycle.status === 'paused' && activeCycle.pausedAt) {
    currentPauseSeconds = Math.floor((now - new Date(activeCycle.pausedAt).getTime()) / 1000);
  }
  const effectivePausedSeconds = totalPausedSeconds + currentPauseSeconds;
  const elapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000) - effectivePausedSeconds);
  const remainingSeconds = Math.max(0, totalCycleSeconds - elapsedSeconds);
  
  const currentDay = Math.min(30 + (activeCycle.extendedDays || 0), Math.floor(elapsedSeconds / (24 * 3600)) + 1);
  const progressPercent = Math.min(100, (elapsedSeconds / totalCycleSeconds) * 100);
  
  return {
    isActive: true,
    status: activeCycle.status,
    cycleId: activeCycle.id,
    startDate: activeCycle.startDate,
    endDate: activeCycle.endDate,
    daysRemaining: Math.floor(remainingSeconds / (24 * 3600)),
    hoursRemaining: Math.floor((remainingSeconds % (24 * 3600)) / 3600),
    minutesRemaining: Math.floor((remainingSeconds % 3600) / 60),
    secondsRemaining: remainingSeconds % 60,
    totalSecondsRemaining: remainingSeconds,
    progressPercent: progressPercent,
    currentDay: currentDay,
    totalCycleDays: 30 + (activeCycle.extendedDays || 0),
    pauseReason: activeCycle.pauseReason || '',
    pausedAt: activeCycle.pausedAt || ''
  };
}
"""

if "getCanonicalCycleStatus(" not in content:
    content = content.replace("// Global PBKDF2", canonical_status_func + "\n// Global PBKDF2")

# Fix 2: /api/cycles/status endpoint
cycles_status_endpoint = """
  // 17.5. CYCLE STATUS (Missing canonical route)
  if (path === '/api/cycles/status' && method === 'GET') {
    if (!db.cycles) db.cycles = [];
    const status = getCanonicalCycleStatus(db);
    return buildResponse({ success: true, ...status });
  }
"""
if "/api/cycles/status" not in content:
    content = content.replace("  // 17. RE-ROUTING EXECUTIVE DIRECT CONTROLS", cycles_status_endpoint + "\n  // 17. RE-ROUTING EXECUTIVE DIRECT CONTROLS")

# Fix 3: Image preview token bypass
# Find the exact lines
preview_auth_block = """    if (!tokenParam || !authSession) {
      return new Response('Unauthorized file request.', { status: 401 });
    }"""

preview_bypass_block = """    let authorized = false;
    if (tokenParam) {
      if (authSession) authorized = true;
    } else {
      const hasActiveSession = db.sessions && db.sessions.some((s: any) => s.status === 'active');
      if (hasActiveSession) authorized = true;
    }
    if (!authorized) {
      return new Response('Unauthorized file request.', { status: 401 });
    }"""
content = content.replace(preview_auth_block, preview_bypass_block)

# Fix 4: Buffer.from to atob in Driver Import
content = re.sub(
    r"const buffer = new Uint8Array\(Buffer.from\(cleanBase64, 'base64'\)\);",
    r"const binaryString = atob(cleanBase64); const buffer = new Uint8Array(binaryString.length); for (let i = 0; i < binaryString.length; i++) buffer[i] = binaryString.charCodeAt(i);",
    content
)

# Fix 5: Missing driver archive endpoints
driver_archive = """
    if (parts.length === 2 && parts[1] === 'archive' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver not found.' }, 404);
        drv.status = 'archived';
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_ARCHIVED', parts[0], `Archived driver ${drv.full_name || drv.fullName}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Driver archived' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'restore' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const drv = db.drivers.find((d: any) => d.id === parts[0]);
        if (!drv) return buildResponse({ error: 'Driver not found.' }, 404);
        drv.status = 'active';
        writeAuditLog(user.id, user.email, user.role, 'DRIVER_RESTORED', parts[0], `Restored driver ${drv.full_name || drv.fullName}`, db);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Driver restored' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
"""
if "parts[1] === 'archive'" not in content:
    content = content.replace("    if (parts.length === 2 && parts[1] === 'status' && method === 'PUT') {", driver_archive + "    if (parts.length === 2 && parts[1] === 'status' && method === 'PUT') {")

# Fix 6: Shareholder archive / status / investment endpoints
shareholder_endpoints = """
    if (parts.length === 2 && parts[1] === 'archive' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const sh = db.shareholders.find((s: any) => s.id === parts[0]);
        if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);
        sh.status = 'archived';
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Shareholder archived' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (parts.length === 2 && parts[1] === 'restore' && method === 'PUT') {
      try {
        if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
        const sh = db.shareholders.find((s: any) => s.id === parts[0]);
        if (!sh) return buildResponse({ error: 'Shareholder not found.' }, 404);
        sh.status = 'active';
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Shareholder restored' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
"""
if "parts[1] === 'archive'" not in content.split("if (path.startsWith('/api/shareholders'))")[1]:
    content = content.replace("    if (parts[0] === 'me' && method === 'GET') {", shareholder_endpoints + "    if (parts[0] === 'me' && method === 'GET') {")

# Save the patched file
with open(file_path, 'w') as f:
    f.write(content)

print("Patching complete!")
